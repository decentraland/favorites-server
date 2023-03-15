export type TPick = {
  itemId: string
  userAddress: string
  listId: string
  createdAt: number
}

export type PickIdsWithCount = { picks: Pick<TPick, "itemId">[]; count: number }
