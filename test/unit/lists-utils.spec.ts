import { DEFAULT_LIST_USER_ADDRESS } from '../../src/migrations/1678303321034_default-list'
import { Permission } from '../../src/ports/access'
import { ListNotFoundError } from '../../src/ports/lists/errors'
import { getListQuery, validateListExists } from '../../src/ports/lists/utils'

describe('when validating if a list exists', () => {
  const listId = 'list-id'

  describe('and the query returns no results', () => {
    it('should throw a ListNotFound error', () => {
      expect(() => validateListExists(listId, { rowCount: 0 })).toThrowError(new ListNotFoundError(listId))
    })
  })
})

describe('when getting the get list query', () => {
  const listId = 'list-id'
  const userAddress = 'user-address'

  it('should return the query with the list id, the user address, and the default list owner user address', () => {
    const query = getListQuery(listId, { userAddress })

    expect(query.text).toContain(
      'WHERE favorites.lists.id = $2 AND (favorites.lists.user_address = $3 OR favorites.lists.user_address = $4)'
    )
    expect(query.values).toEqual(expect.arrayContaining([listId, userAddress, DEFAULT_LIST_USER_ADDRESS]))
  })

  describe('and the considerDefaultList option is set to false', () => {
    it('should return the query with the list id and the user address', () => {
      const query = getListQuery(listId, { userAddress, considerDefaultList: false })

      expect(query.text).toContain('WHERE favorites.lists.id = $2 AND (favorites.lists.user_address = $3)')
      expect(query.values).toEqual(expect.arrayContaining([listId, userAddress]))
    })
  })

  describe('and the required permission is set', () => {
    describe('and is set to view', () => {
      it('should return the query with the list id, the user address, and the check if the user has view or edit access to the list', () => {
        const query = getListQuery(listId, { userAddress, requiredPermission: Permission.VIEW })

        expect(query.text).toContain('OR ((favorites.acl.grantee = $5 OR favorites.acl.grantee = $6) AND favorites.acl.permission IN ($7))')
        expect(query.values).toEqual(expect.arrayContaining([userAddress, '*', `${Permission.VIEW},${Permission.EDIT}`]))
      })
    })

    describe('and is set to edit', () => {
      it('should return the query with the list id, the user address, and the check if the user has edit access to the list', () => {
        const query = getListQuery(listId, { userAddress, requiredPermission: Permission.EDIT })

        expect(query.text).toContain('OR ((favorites.acl.grantee = $5 OR favorites.acl.grantee = $6) AND favorites.acl.permission IN ($7))')
        expect(query.values).toEqual(expect.arrayContaining([userAddress, '*', Permission.EDIT]))
      })
    })
  })
})
