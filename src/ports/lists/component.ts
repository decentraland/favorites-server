import SQL from 'sql-template-strings'
import { isErrorWithMessage } from '../../logic/errors'
import { DEFAULT_LIST_USER_ADDRESS } from '../../migrations/1678303321034_default-list'
import { AppComponents } from '../../types'
import { Permission } from '../access'
import { DBGetFilteredPicksWithCount, DBPick } from '../picks'
import {
  DuplicatedListError,
  ItemNotFoundError,
  ListNotFoundError,
  PickAlreadyExistsError,
  PickNotFoundError,
  QueryFailure
} from './errors'
import {
  GetAuthenticatedAndPaginatedParameters,
  IListsComponents,
  DBList,
  DBGetListsWithCount,
  AddListRequestBody,
  GetListsParameters,
  ListSortBy,
  ListSortDirection,
  GetListOptions,
  DBListsWithItemsCount
} from './types'

const GRANTED_TO_ALL = '*'

export function createListsComponent(
  components: Pick<AppComponents, 'pg' | 'collectionsSubgraph' | 'snapshot' | 'logs'>
): IListsComponents {
  const { pg, collectionsSubgraph, snapshot, logs } = components
  const logger = logs.getLogger('Lists component')

  async function getPicksByListId(listId: string, params: GetAuthenticatedAndPaginatedParameters): Promise<DBGetFilteredPicksWithCount[]> {
    const { userAddress, limit, offset } = params
    const result = await pg.query<DBGetFilteredPicksWithCount>(SQL`
        SELECT DISTINCT(p.item_id), p.*, COUNT(*) OVER() as picks_count FROM favorites.picks p
        LEFT JOIN favorites.acl ON p.list_id = favorites.acl.list_id
        WHERE p.list_id = ${listId} AND (p.user_address = ${userAddress} OR favorites.acl.grantee = ${userAddress} OR favorites.acl.grantee = ${GRANTED_TO_ALL})
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
    `)
    return result.rows
  }

  async function getList(
    listId: string,
    { requiredPermission, considerDefaultList = true, userAddress }: GetListOptions
  ): Promise<DBListsWithItemsCount> {
    const getListQuery = SQL`
      SELECT DISTINCT favorites.lists.*, favorites.acl.permission AS permission, COUNT(DISTINCT favorites.picks.item_id) AS count_items
      FROM favorites.lists
      LEFT JOIN favorites.picks ON favorites.lists.id = favorites.picks.list_id AND favorites.picks.user_address = ${userAddress}
      LEFT JOIN favorites.acl ON favorites.lists.id = favorites.acl.list_id`

    getListQuery.append(SQL` WHERE favorites.lists.id = ${listId} AND (favorites.lists.user_address = ${userAddress}`)
    if (considerDefaultList) {
      getListQuery.append(SQL` OR favorites.lists.user_address = ${DEFAULT_LIST_USER_ADDRESS}`)
    }
    getListQuery.append(')')

    if (requiredPermission) {
      const requiredPermissions = (requiredPermission === Permission.VIEW ? [Permission.VIEW, Permission.EDIT] : [requiredPermission]).join(
        ','
      )
      getListQuery.append(
        SQL` OR ((favorites.acl.grantee = ${userAddress} OR favorites.acl.grantee = ${GRANTED_TO_ALL}) AND favorites.acl.permission IN (${requiredPermissions}))`
      )
    }

    getListQuery.append(SQL` GROUP BY favorites.lists.id, favorites.acl.permission`)

    const result = await pg.query<DBListsWithItemsCount>(getListQuery)

    if (result.rowCount === 0) {
      throw new ListNotFoundError(listId)
    }

    return result.rows[0]
  }

  async function addPickToList(listId: string, itemId: string, userAddress: string): Promise<DBPick> {
    const list = await getList(listId, { userAddress, requiredPermission: Permission.EDIT })
    const [queryResult, power] = await Promise.allSettled([
      collectionsSubgraph.query<{ items: { id: string }[] }>(
        `query items($itemId: String) {
        items(first: 1, where: { id: $itemId }) {
          id
        }
      }`,
        { itemId }
      ),
      snapshot.getScore(userAddress)
    ])

    if (queryResult.status === 'rejected') {
      logger.error('Querying the collections subgraph failed.')
      throw new QueryFailure(isErrorWithMessage(queryResult.reason) ? queryResult.reason.message : 'Unknown')
    }

    const vpQuery = SQL`INSERT INTO favorites.voting (user_address, power) `

    // If the snapshot query fails, try to set the VP to 0 without overwriting it if it already exists
    if (power.status === 'rejected') {
      logger.error(`Querying snapshot failed: ${isErrorWithMessage(power.reason) ? power.reason.message : 'Unknown'}`)
      vpQuery.append(SQL`VALUES (${userAddress}, ${0}) ON CONFLICT (user_address) DO NOTHING`)
    } else {
      logger.info(`The voting power for ${userAddress} was updated to ${power.value}`)
      vpQuery.append(SQL`VALUES (${userAddress}, ${power.value}) ON CONFLICT (user_address) DO UPDATE SET power = ${power.value}`)
    }

    if (queryResult.value.items.length === 0) {
      throw new ItemNotFoundError(itemId)
    }

    const client = await pg.getPool().connect()
    try {
      await client.query('BEGIN')
      const results = await Promise.all([
        client.query<DBPick>(
          SQL`INSERT INTO favorites.picks (item_id, user_address, list_id) VALUES (${itemId}, ${userAddress}, ${list.id}) RETURNING *`
        ),
        client.query(vpQuery)
      ])
      await client.query('COMMIT')

      return results[0].rows[0]
    } catch (error) {
      await client.query('ROLLBACK')
      if (error && typeof error === 'object' && 'constraint' in error && error.constraint === 'item_id_user_address_list_id_primary_key') {
        throw new PickAlreadyExistsError(listId, itemId)
      }

      throw new Error("The pick couldn't be created")
    } finally {
      // TODO: handle the following eslint-disable statement
      // eslint-disable-next-line @typescript-eslint/await-thenable
      await client.release()
    }
  }

  async function deletePickInList(listId: string, itemId: string, userAddress: string): Promise<void> {
    const result = await pg.query(
      SQL`DELETE FROM favorites.picks
      WHERE favorites.picks.list_id = ${listId}
      AND favorites.picks.item_id = ${itemId}
      AND favorites.picks.user_address = ${userAddress}`
    )
    if (result.rowCount === 0) {
      throw new PickNotFoundError(listId, itemId)
    }
  }

  async function getLists(params: GetListsParameters): Promise<DBGetListsWithCount[]> {
    const { userAddress, limit, offset, sortBy = ListSortBy.CREATED_AT, sortDirection = ListSortDirection.DESC } = params
    const query = SQL`
        SELECT l.*, COUNT(*) OVER() as lists_count, user_address = ${DEFAULT_LIST_USER_ADDRESS} as is_default_list, COUNT(DISTINCT p.item_id) AS items_count
        FROM favorites.lists l
        LEFT JOIN favorites.picks p ON l.id = p.list_id AND p.user_address = ${userAddress}
        WHERE user_address = ${userAddress} OR user_address = ${DEFAULT_LIST_USER_ADDRESS}
        `
    const orderByQuery = SQL`ORDER BY is_default_list DESC`

    switch (sortBy) {
      case ListSortBy.CREATED_AT:
        orderByQuery.append(SQL`, created_at ${sortDirection}`)
        break
      case ListSortBy.NAME:
        orderByQuery.append(SQL`, name ${sortDirection}`)
        break
    }

    query.append(orderByQuery)
    query.append(SQL`\nLIMIT ${limit} OFFSET ${offset}`)

    const result = await pg.query<DBGetListsWithCount>(query)
    return result.rows
  }

  async function addList({ name, userAddress }: AddListRequestBody): Promise<DBList> {
    try {
      const result = await pg.query<DBList>(
        SQL`INSERT INTO favorites.lists (name, user_address) VALUES (${name}, ${userAddress}) RETURNING *`
      )

      return result.rows[0]
    } catch (error) {
      if (error && typeof error === 'object' && 'constraint' in error && error.constraint === 'name_user_address_unique') {
        throw new DuplicatedListError(name)
      }

      throw new Error("The list couldn't be created")
    }
  }

  async function deleteList(id: string, userAddress: string): Promise<void> {
    const result = await pg.query(
      SQL`DELETE FROM favorites.lists
      WHERE favorites.lists.id = ${id}
      AND favorites.lists.user_address = ${userAddress}`
    )
    if (result.rowCount === 0) {
      throw new ListNotFoundError(id)
    }
  }

  return { getPicksByListId, addPickToList, deletePickInList, getLists, addList, deleteList, getList }
}
