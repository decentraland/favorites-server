import { JSONSchema } from '@dcl/schemas'
import { PaginationParameters } from '../../logic/http'
import { DBGetFilteredPicksWithCount, DBPick } from '../../ports/picks'
import { Permission } from '../access'

export interface IListsComponents {
  getPicksByListId(listId: string, options?: GetAuthenticatedAndPaginatedParameters): Promise<DBGetFilteredPicksWithCount[]>
  addPickToList(listId: string, itemId: string, userAddress: string): Promise<DBPick>
  deletePickInList(listId: string, itemId: string, userAddress: string): Promise<void>
  getLists(options?: GetListsParameters): Promise<DBGetListsWithCount[]>
  addList(newList: NewList): Promise<DBList>
  deleteList(id: string, userAddress: string): Promise<void>
  getList(listId: string, options?: GetListOptions): Promise<DBListsWithItemsCount>
  updateList(id: string, userAddress: string, updatedList: UpdateListRequestBody): Promise<DBList>
}

export type GetAuthenticatedAndPaginatedParameters = {
  userAddress: string
} & PaginationParameters

export type GetListsParameters = GetAuthenticatedAndPaginatedParameters & {
  sortBy?: ListSortBy
  sortDirection?: ListSortDirection
  itemId?: string | null
  q?: string | null
}

export type GetListOptions = {
  userAddress?: string
  considerDefaultList?: boolean
  requiredPermission?: Permission
}

export type DBList = {
  id: string
  name: string
  description: string | null
  user_address: string
  created_at: Date
  permission?: string | null
}

export type DBListsWithItemsCount = DBList & {
  items_count: string
}

export type DBGetListsWithCount = DBListsWithItemsCount & {
  lists_count: string
  is_item_in_list?: boolean
}

export type AddListRequestBody = {
  name: string
  description?: string
  private: boolean
}

export type UpdateListRequestBody = Partial<AddListRequestBody>

export type NewList = AddListRequestBody & {
  userAddress: string
}

export enum ListSortBy {
  CREATED_AT = 'createdAt',
  NAME = 'name'
}

export enum ListSortDirection {
  ASC = 'asc',
  DESC = 'desc'
}

export const ListCreationSchema: JSONSchema<AddListRequestBody> = {
  type: 'object',
  properties: {
    name: {
      type: 'string',
      minLength: 1,
      maxLength: 32,
      description: 'The name of the list'
    },
    description: {
      type: 'string',
      maxLength: 100,
      nullable: true,
      default: null,
      description: 'A description of the list'
    },
    private: {
      type: 'boolean',
      description: 'Whether the list is private or not',
      nullable: false
    }
  },
  required: ['name', 'private']
}
