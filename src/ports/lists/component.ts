import SQL from 'sql-template-strings'
import { isErrorWithMessage } from '../../logic/errors'
import { DEFAULT_LIST_USER_ADDRESS } from '../../migrations/1678303321034_default-list'
import { AppComponents } from '../../types'
import { Permission } from '../access'
import { AccessNotFoundError } from '../access/errors'
import { deleteAccessQuery, insertAccessQuery } from '../access/queries'
import { validateAccessExists, validateDuplicatedAccess } from '../access/utils'
import { DBGetFilteredPicksWithCount, DBPick } from '../picks'
import { GRANTED_TO_ALL } from './constants'
import {
  DuplicatedListError,
  ItemNotFoundError,
  ListNotFoundError,
  PickAlreadyExistsError,
  PickNotFoundError,
  QueryFailure
} from './errors'
import { getListQuery } from './queries'
import {
  GetAuthenticatedAndPaginatedParameters,
  IListsComponents,
  DBList,
  DBGetListsWithCount,
  GetListsParameters,
  ListSortBy,
  ListSortDirection,
  GetListOptions,
  DBListsWithItemsCount,
  UpdateListRequestBody,
  NewList
} from './types'
import { validateListExists } from './utils'

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

  async function getList(listId: string, options: GetListOptions): Promise<DBListsWithItemsCount> {
    const query = getListQuery(listId, options)

    const result = await pg.query<DBListsWithItemsCount>(query)

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
    const { userAddress, limit, offset, sortBy = ListSortBy.CREATED_AT, sortDirection = ListSortDirection.DESC, itemId, q } = params
    const query = SQL`SELECT l.*, COUNT(*) OVER() as lists_count, l.user_address = ${DEFAULT_LIST_USER_ADDRESS} as is_default_list, COUNT(p.item_id) AS items_count`

    if (itemId) query.append(SQL`, MAX(CASE WHEN p.item_id = ${itemId} THEN 1 ELSE 0 END)::BOOLEAN AS is_item_in_list`)

    query.append(SQL`
      FROM favorites.lists l
      LEFT JOIN favorites.picks p ON l.id = p.list_id AND p.user_address = ${userAddress}
      WHERE l.user_address = ${userAddress} OR l.user_address = ${DEFAULT_LIST_USER_ADDRESS}`)

    if (q) {
      query.append(SQL` AND l.name ILIKE '%${q}%'`)
    }

    const orderByQuery = SQL`\nORDER BY is_default_list DESC`
    // Converts the sort direction into a explicit string to avoid using the SQL statement
    const sortDirectionKeyword = ListSortDirection.DESC === sortDirection ? 'DESC' : 'ASC'

    switch (sortBy) {
      case ListSortBy.CREATED_AT:
        orderByQuery.append(`, l.created_at ${sortDirectionKeyword}`)
        break
      case ListSortBy.NAME:
        orderByQuery.append(`, l.name ${sortDirectionKeyword}`)
        break
    }

    query.append(SQL`\nGROUP BY l.id`)
    query.append(orderByQuery)
    query.append(SQL`\nLIMIT ${limit} OFFSET ${offset}`)

    const result = await pg.query<DBGetListsWithCount>(query)
    return result.rows
  }

  async function addList({ name, description, userAddress }: NewList): Promise<DBList> {
    try {
      const result = await pg.query<DBList>(
        SQL`INSERT INTO favorites.lists (name, description, user_address) VALUES (${name}, ${
          description ?? null
        }, ${userAddress}) RETURNING *`
      )

      return result.rows[0]
    } catch (error) {
      if (error && typeof error === 'object' && 'constraint' in error && error.constraint === 'name_user_address_unique') {
        throw new DuplicatedListError(name)
      }

      throw new Error("The list couldn't be created")
    }
  }

  async function updateList(id: string, userAddress: string, updatedList: UpdateListRequestBody): Promise<DBList> {
    const { name, description, private: isPrivate } = updatedList
    const shouldUpdate = name || description

    const client = await pg.getPool().connect()
    const accessQuery = isPrivate
      ? deleteAccessQuery(id, Permission.VIEW, GRANTED_TO_ALL, userAddress)
      : insertAccessQuery(id, Permission.VIEW, GRANTED_TO_ALL)

    try {
      await client.query('BEGIN')
      const updateQuery = SQL`UPDATE favorites.lists SET `

      if (name) updateQuery.append(SQL`name = ${name}`)
      if (name && description) updateQuery.append(SQL`, `)
      if (description) updateQuery.append(SQL`description = ${description}`)

      updateQuery.append(SQL` WHERE id = ${id} AND user_address = ${userAddress} RETURNING *`)

      const [updatedListResult, accessResult] = await Promise.all([
        client.query<DBList>(shouldUpdate ? updateQuery : getListQuery(id, { userAddress })),
        client.query(accessQuery)
      ])

      validateListExists(id, updatedListResult)

      if (isPrivate) validateAccessExists(id, Permission.VIEW, GRANTED_TO_ALL, accessResult)

      await client.query('COMMIT')

      return updatedListResult.rows[0]
    } catch (error) {
      await client.query('ROLLBACK')

      if (error instanceof ListNotFoundError || error instanceof AccessNotFoundError) throw error

      if (name && error && typeof error === 'object' && 'constraint' in error && error.constraint === 'name_user_address_unique') {
        throw new DuplicatedListError(name)
      }

      validateDuplicatedAccess(id, Permission.VIEW, GRANTED_TO_ALL, error)

      throw new Error("The list couldn't be updated")
    } finally {
      // TODO: handle the following eslint-disable statement
      // eslint-disable-next-line @typescript-eslint/await-thenable
      await client.release()
    }
  }

  async function deleteList(id: string, userAddress: string): Promise<void> {
    const result = await pg.query(
      SQL`DELETE FROM favorites.lists
      WHERE favorites.lists.id = ${id}
      AND favorites.lists.user_address = ${userAddress}`
    )

    validateListExists(id, result)
  }

  return { getPicksByListId, addPickToList, deletePickInList, getLists, addList, deleteList, getList, updateList }
}
