export type PaginatedResponse<T> = {
  results: T[]
  total: number
  page: number
  pages: number
  limit: number
}

export type GetPaginatedParameters = {
  offset: number
  limit: number
}
