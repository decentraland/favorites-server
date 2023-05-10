import { ILoggerComponent } from '@well-known-components/interfaces'
import { IPgComponent } from '@well-known-components/pg-component'
import { IAccessComponent, Permission, createAccessComponent } from '../../src/ports/access'
import { AccessNotFoundError } from '../../src/ports/access/errors'
import { createTestLogsComponent, createTestPgComponent } from '../components'

let accessComponent: IAccessComponent
let loggerComponent: ILoggerComponent
let pgComponentMock: IPgComponent
let queryMock: jest.Mock

beforeEach(() => {
  queryMock = jest.fn()
  pgComponentMock = createTestPgComponent({ query: queryMock })
  loggerComponent = createTestLogsComponent({ getLogger: jest.fn().mockReturnValue({ info: () => undefined }) })
  accessComponent = createAccessComponent({ pg: pgComponentMock, logs: loggerComponent })
})

describe('when deleting an access', () => {
  let listId: string
  let permission: Permission
  let grantee: string
  let listOwner: string

  describe('and nothing got deleted', () => {
    beforeEach(() => {
      queryMock.mockResolvedValueOnce({ rowCount: 0 })
    })

    it('should return an access not found error', () => {
      return expect(accessComponent.deleteAccess(listId, permission, grantee, listOwner)).rejects.toEqual(
        new AccessNotFoundError(listId, permission, grantee)
      )
    })
  })

  describe('and an access got deleted', () => {
    beforeEach(async () => {
      queryMock.mockResolvedValueOnce({ rowCount: 1 })
      await accessComponent.deleteAccess(listId, permission, grantee, listOwner)
    })

    it('should delete the access taking into consideration the list id, the permission, the grantee and the list owner', () => {
      expect(queryMock).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('AND favorites.acl.list_id = $1'),
          values: expect.arrayContaining([listId])
        })
      )

      expect(queryMock).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('AND favorites.lists.user_address = $2'),
          values: expect.arrayContaining([listOwner])
        })
      )

      expect(queryMock).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('AND favorites.acl.permission = $3'),
          values: expect.arrayContaining([permission])
        })
      )

      expect(queryMock).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('AND favorites.acl.grantee = $4'),
          values: expect.arrayContaining([grantee])
        })
      )
    })
  })
})
