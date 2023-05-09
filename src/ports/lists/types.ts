import { PaginationParameters } from '../../logic/http'
import { DBGetFilteredPicksWithCount, DBPick } from '../../ports/picks'

export interface IListsComponents {
  getPicksByListId(listId: string, options?: GetAuthenticatedAndPaginatedParameters): Promise<DBGetFilteredPicksWithCount[]>
  addPickToList(listId: string, itemId: string, userAddress: string): Promise<DBPick>
  deletePickInList(listId: string, itemId: string, userAddress: string): Promise<void>
  getLists(options?: GetListsParameters): Promise<DBGetListsWithCount[]>
  addList(newList: AddListRequestBody): Promise<DBList>
}

export type GetAuthenticatedAndPaginatedParameters = {
  userAddress: string
} & PaginationParameters

export type GetListsParameters = GetAuthenticatedAndPaginatedParameters & {
  sortBy?: ListSortBy
  sortDirection?: ListSortDirection
}

export type DBList = {
  id: string
  name: string
  description: string | null
  user_address: string
}

export type DBGetListsWithCount = DBList & {
  lists_count: string
}

export type AddListRequestBody = {
  name: string
  description?: string
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
