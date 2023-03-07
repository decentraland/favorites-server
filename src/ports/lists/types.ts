export interface IListsComponents {
  getPicksByListId(listId: string, params: GetPicksByListIdParameters): Promise<DBGetPickByListId[]>
}

export type GetPicksByListIdParameters = {
  userAddress: string
  offset: number
  limit: number
}

export type PickRow = {
  item_id: string
}

export type DBGetPickByListId = PickRow & {
  picks_count: number
}

export type Pick = {
  itemId: string
}

export type PicksWithCount = { picks: Pick[]; count: number }
