import { Permission } from '../../ports/access'
import { TPick } from '../picks'

export type PickIdsWithCount = { picks: Pick<TPick, 'itemId' | 'createdAt'>[]; count: number }

export type List = {
  id: string
  name: string
  description: string | null
  userAddress: string
  createdAt: number
  updatedAt: number | null
  permission?: Permission | null
  isPrivate: boolean
}

export type ListWithItemsCount = List & {
  itemsCount: number
}

export type ListsWithCount = {
  lists: (Pick<ListWithItemsCount, 'id' | 'name' | 'itemsCount' | 'isPrivate'> & { isItemInList?: boolean; previewOfItemIds?: string[] })[]
  count: number
}
