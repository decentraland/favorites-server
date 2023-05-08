import SQL from 'sql-template-strings'
import { isErrorWithMessage } from '../../logic/errors'
import { DEFAULT_LIST_USER_ADDRESS } from '../../migrations/1678303321034_default-list'
import { AppComponents } from '../../types'
import { DBGetFilteredPicksWithCount, DBPick } from '../picks'
import {
  DuplicatedListError,
  ItemNotFoundError,
  ListNotFoundError,
  PickAlreadyExistsError,
  PickNotFoundError,
  QueryFailure
} from './errors'
import { GetAuthenticatedAndPaginatedParameters, IListsComponents, DBList, DBGetListsWithCount, AddListRequestBody } from './types'

export function createListsComponent(
  components: Pick<AppComponents, 'pg' | 'collectionsSubgraph' | 'snapshot' | 'logs'>
): IListsComponents {
  const { pg, collectionsSubgraph, snapshot, logs } = components
  const logger = logs.getLogger('Lists component')

  async function getPicksByListId(listId: string, params: GetAuthenticatedAndPaginatedParameters): Promise<DBGetFilteredPicksWithCount[]> {
    const { userAddress, limit, offset } = params
    const result = await pg.query<DBGetFilteredPicksWithCount>(SQL`
        SELECT p.*, COUNT(*) OVER() as picks_count FROM favorites.picks p
        WHERE list_id = ${listId} AND user_address = ${userAddress}
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
    `)
    return result.rows
  }

  async function getList(listId: string, userAddress: string): Promise<DBList> {
    const result = await pg.query<DBList>(
      SQL`SELECT * from favorites.lists WHERE id = ${listId} AND (user_address = ${userAddress} OR user_address = ${DEFAULT_LIST_USER_ADDRESS})`
    )
    if (result.rowCount === 0) {
      throw new ListNotFoundError(listId)
    }

    return result.rows[0]
  }

  async function addPickToList(listId: string, itemId: string, userAddress: string): Promise<DBPick> {
    const list = await getList(listId, userAddress)
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

  async function getLists(params: GetAuthenticatedAndPaginatedParameters): Promise<DBGetListsWithCount[]> {
    const { userAddress, limit, offset } = params
    // TODO: do we want to sort the lists using another criteria?
    const result = await pg.query<DBGetListsWithCount>(SQL`
        SELECT l.*, COUNT(*) OVER() as lists_count, user_address = ${DEFAULT_LIST_USER_ADDRESS} as is_default_list
        FROM favorites.lists l
        WHERE user_address = ${userAddress} OR user_address = ${DEFAULT_LIST_USER_ADDRESS}
        ORDER BY is_default_list DESC
        LIMIT ${limit} OFFSET ${offset}
    `)
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

  return { getPicksByListId, addPickToList, deletePickInList, getLists, addList }
}
