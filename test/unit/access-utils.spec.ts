import { Permission } from '../../src/ports/access'
import { AccessNotFoundError, DuplicatedAccessError } from '../../src/ports/access/errors'
import { validateAccessExists, validateDuplicatedAccess } from '../../src/ports/access/utils'

const listId = 'list-id'
const permission = Permission.VIEW
const grantee = '*'

describe('when validating if an access exists', () => {
  describe('and the query returns no results', () => {
    it('should throw a AccessNotFound error', () => {
      expect(() => validateAccessExists(listId, permission, grantee, { rowCount: 0 })).toThrowError(
        new AccessNotFoundError(listId, permission, grantee)
      )
    })
  })
})

describe('when validating if an access is being duplicated', () => {
  describe('and the error has the constraint of a duplicated primary key', () => {
    it('should throw a DuplicatedAccess error', () => {
      expect(() =>
        validateDuplicatedAccess(listId, permission, grantee, { constraint: 'list_id_permissions_grantee_primary_key' })
      ).toThrowError(new DuplicatedAccessError(listId, permission, grantee))
    })
  })
})
