import { PaginationParameters } from "../../logic/http"

export interface IPicksComponent {
  getPickStats(itemId: string, options?: { userAddress?: string; power?: number }): Promise<PickStats>
  getPicksByItemId(itemId: string, options: PaginationParameters): Promise<DBGetFilteredPicksWithCount[]>
}

export type PickStats = {
  likedByUser?: boolean
  count: number
}

export type GetPicksByItemIdParameters = PaginationParameters

export type DBPick = {
  item_id: string
  user_address: string
  list_id: string
  created_at: Date
}

export type DBGetFilteredPicksWithCount = DBPick & {
  picks_count: number
}
