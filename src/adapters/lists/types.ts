import { Permission } from '../../ports/access'
import { TPick } from '../picks'

export type PickIdsWithCount = { picks: Pick<TPick, 'itemId' | 'createdAt'>[]; count: number }

export type List = {
  id: string
  name: string
  description: string | null
  userAddress: string
  createdAt: Date
  permission?: Permission | null
}

export type ListWithItemsCount = List & {
  itemsCount: number
}

export type ListsWithCount = { lists: Pick<ListWithItemsCount, 'id' | 'name' | 'itemsCount'>[]; count: number }
