import SQL from "sql-template-strings"
import { DEFAULT_LIST_USER_ADDRESS } from "../../migrations/1678303321034_default-list"
import { AppComponents } from "../../types"
import { ItemNotFoundError, ListNotFoundError, PickAlreadyExistsError, PickNotFoundError } from "./errors"
import { GetPicksByListIdParameters, IListsComponents, DBGetPickByListId, DBList, DBPick } from "./types"

export function createListsComponent(components: Pick<AppComponents, "pg" | "collectionsSubgraph">): IListsComponents {
  const { pg, collectionsSubgraph } = components

  async function getPicksByListId(listId: string, params: GetPicksByListIdParameters): Promise<DBGetPickByListId[]> {
    const { userAddress, limit, offset } = params
    const result = await pg.query<DBGetPickByListId>(SQL`
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
    const queryResult = await collectionsSubgraph.query<{ items: { id: string }[] }>(
      `query items($itemId: String) {
        items(first: 1, where: { id: $itemId }) {
          id
        }
      }`,
      { itemId }
    )

    if (queryResult.items.length === 0) {
      throw new ItemNotFoundError(itemId)
    }

    try {
      const result = await pg.query<DBPick>(
        SQL`INSERT INTO favorites.picks (item_id, user_address, list_id) VALUES (${itemId}, ${userAddress}, ${list.id}) RETURNING *`
      )

      return result.rows[0]
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "constraint" in error &&
        error.constraint === "item_id_user_address_list_id_primary_key"
      ) {
        throw new PickAlreadyExistsError(listId, itemId)
      }

      throw new Error("The pick couldn't be created")
    }
  }

  async function deletePickInList(listId: string, itemId: string, userAddress: string): Promise<void> {
    const result = await pg.query(
      SQL`DELETE FROM favorites.picks USING favorites.lists
      WHERE favorites.lists.id = favorites.picks.list_id AND favorites.picks.list_id = ${listId}
      AND favorites.picks.item_id = ${itemId}
      AND favorites.picks.user_address = ${userAddress}
      AND (favorites.lists.user_address = ${userAddress} OR favorites.lists.user_address = ${DEFAULT_LIST_USER_ADDRESS})`
    )
    if (result.rowCount === 0) {
      throw new PickNotFoundError(listId, itemId)
    }
  }

  return { getPicksByListId, addPickToList, deletePickInList }
}
