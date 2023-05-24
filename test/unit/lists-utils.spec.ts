import { ListNotFoundError } from '../../src/ports/lists/errors'
import { validateListExists } from '../../src/ports/lists/utils'

describe('when validating if a list exists', () => {
  const listId = 'list-id'

  describe('and the query returns no results', () => {
    it('should throw a ListNotFound error', () => {
      expect(() => validateListExists(listId, { rowCount: 0 })).toThrowError(new ListNotFoundError(listId))
    })
  })
})
