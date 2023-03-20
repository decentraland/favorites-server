import { GetPaginatedParameters } from "../../logic/http"
import { DBGetFilteredPicksWithCount, DBPick } from "../../ports/picks"

export interface IListsComponents {
  getPicksByListId(listId: string, options?: GetPicksByListIdParameters): Promise<DBGetFilteredPicksWithCount[]>
  addPickToList(listId: string, itemId: string, userAddress: string): Promise<DBPick>
  deletePickInList(listId: string, itemId: string, userAddress: string): Promise<void>
}

export type GetPicksByListIdParameters = {
  userAddress: string
} & GetPaginatedParameters

export type DBList = {
  id: string
  name: string
  description: string | null
  user_address: string
}
