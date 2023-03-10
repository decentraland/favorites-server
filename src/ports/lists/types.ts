export interface IListsComponents {
  getPicksByListId(listId: string, params: GetPicksByListIdParameters): Promise<DBGetPickByListId[]>
  addPickToList(listId: string, itemId: string, userAddress: string): Promise<DBPick>
}

export type DBPick = {
  item_id: string
  user_address: string
  list_id: string
  created_at: Date
}

export type GetPicksByListIdParameters = {
  userAddress: string
  offset: number
  limit: number
}

export type DBList = {
  id: string
  name: string
  description: string | null
  user_address: string
}

export type DBGetPickByListId = DBPick & {
  picks_count: number
}
