import { ListNotFoundError } from './errors'

export function validateListExists(id: string, result: { rowCount: number }) {
  if (result.rowCount === 0) {
    throw new ListNotFoundError(id)
  }
}
