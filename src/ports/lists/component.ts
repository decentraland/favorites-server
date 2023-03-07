import SQL from "sql-template-strings"
import { AppComponents } from "../../types"
import { GetPicksByListIdParameters, IListsComponents, DBGetPickByListId } from "./types"

export function createListsComponent(components: Pick<AppComponents, "pg">): IListsComponents {
  const { pg } = components

  async function getPicksByListId(listId: string, params: GetPicksByListIdParameters): Promise<DBGetPickByListId[]> {
    const { userAddress, limit, offset } = params
    const result = await pg.query<DBGetPickByListId>(SQL`
        SELECT p.*, COUNT(*) OVER() as picks_count FROM picks p
        WHERE list_id = ${listId} AND user_address = ${userAddress}
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
    `)
    return result.rows
  }

  return { getPicksByListId }
}
