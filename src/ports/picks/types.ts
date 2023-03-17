export interface IPicksComponent {
  getPickStats(itemId: string, options?: { userAddress?: string; power?: number }): Promise<PickStats>
}

export type PickStats = {
  likedByUser?: boolean
  count: number
}
