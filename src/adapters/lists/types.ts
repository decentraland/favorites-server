import { TPick } from '../picks'

export type PickIdsWithCount = { picks: Pick<TPick, 'itemId' | 'createdAt'>[]; count: number }

export type List = {
  id: string
  name: string
  description: string | null
  userAddress: string
}

export type ListsWithCount = { lists: Pick<List, 'id' | 'name'>[]; count: number }
