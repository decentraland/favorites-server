import * as authorizationMiddleware from 'decentraland-crypto-middleware'
import { List } from '../../src/adapters/lists'
import { TPick } from '../../src/adapters/picks'
import {
  createListHandler,
  createPickInListHandler,
  deletePickInListHandler,
  getPicksByListIdHandler,
  getListsHandler,
  deleteAccessHandler,
  deleteListHandler,
  createAccessHandler,
  getListHandler
} from '../../src/controllers/handlers/lists-handlers'
import { Permission } from '../../src/ports/access'
import { AccessNotFoundError, DuplicatedAccessError } from '../../src/ports/access/errors'
import { DBGetListsWithCount, DBList } from '../../src/ports/lists'
import {
  DuplicatedListError,
  ItemNotFoundError,
  ListNotFoundError,
  PickAlreadyExistsError,
  PickNotFoundError
} from '../../src/ports/lists/errors'
import { DBGetFilteredPicksWithCount, DBPick } from '../../src/ports/picks'
import { AppComponents, HandlerContextWithPath, StatusCode } from '../../src/types'
import { createTestListsComponent, createTestAccessComponent } from '../components'

let verification: authorizationMiddleware.DecentralandSignatureData | undefined
let listId: string

beforeEach(() => {
  verification = { auth: '0x0', authMetadata: {} }
})

describe('when getting the picks of a list', () => {
  let url: URL
  let components: Pick<AppComponents, 'lists'>
  let getPicksByListIdMock: jest.Mock
  let request: HandlerContextWithPath<'lists', '/v1/lists/:id/picks'>['request']
  let params: HandlerContextWithPath<'lists', '/v1/lists/:id/picks'>['params']

  beforeEach(() => {
    listId = 'list-id'
    getPicksByListIdMock = jest.fn()
    components = {
      lists: createTestListsComponent({
        getPicksByListId: getPicksByListIdMock
      })
    }
    request = {} as HandlerContextWithPath<'lists', '/v1/lists/:id/picks'>['request']
    url = new URL(`http://localhost/v1/lists/${listId}/picks`)
    params = { id: listId }
  })

  describe('and the request is not authenticated', () => {
    beforeEach(() => {
      verification = undefined
    })

    it('should return an unauthorized response', () => {
      return expect(
        getPicksByListIdHandler({
          url,
          components,
          verification,
          request,
          params
        })
      ).resolves.toEqual({
        status: StatusCode.UNAUTHORIZED,
        body: {
          ok: false,
          message: 'Unauthorized',
          data: undefined
        }
      })
    })
  })

  describe('and the process to get the picks fails', () => {
    let error: Error

    beforeEach(() => {
      error = new Error('anError')
      getPicksByListIdMock.mockRejectedValueOnce(error)
    })

    it('should propagate the error', () => {
      return expect(
        getPicksByListIdHandler({
          url,
          components,
          verification,
          request,
          params
        })
      ).rejects.toEqual(error)
    })
  })

  describe('and the process to get the picks is successful', () => {
    let dbPicksByListId: DBGetFilteredPicksWithCount[]
    let picks: Pick<TPick, 'itemId' | 'createdAt'>[]

    beforeEach(() => {
      dbPicksByListId = [
        {
          item_id: '1',
          user_address: '0x45abb534BD927284F84b03d43f33dF0E5C91C21f',
          list_id: 'e96df126-f5bf-4311-94d8-6e261f368bb2',
          created_at: new Date(),
          picks_count: '1'
        }
      ]
      picks = [{ itemId: '1', createdAt: Number(dbPicksByListId[0].created_at) }]
      getPicksByListIdMock.mockResolvedValueOnce(dbPicksByListId)
    })

    it('should return a response with an ok status code and the picks', () => {
      return expect(
        getPicksByListIdHandler({
          url,
          components,
          verification,
          request,
          params
        })
      ).resolves.toEqual({
        status: StatusCode.OK,
        body: {
          ok: true,
          data: {
            results: picks,
            total: 1,
            page: 0,
            pages: 1,
            limit: 100
          }
        }
      })
    })
  })
})

describe('when creating a pick', () => {
  let itemId: string
  let components: Pick<AppComponents, 'lists'>
  let request: HandlerContextWithPath<'lists', '/v1/lists/:id'>['request']
  let params: HandlerContextWithPath<'lists', '/v1/lists/:id'>['params']
  let jsonMock: jest.Mock
  let addPickToListMock: jest.Mock

  beforeEach(() => {
    listId = '99ffdcd4-0647-41e7-a865-996e2071ed62'
    itemId = '0x08de0de733cc11081d43569b809c00e6ddf314fb-0'
    jsonMock = jest.fn()
    addPickToListMock = jest.fn()
    components = {
      lists: createTestListsComponent({ addPickToList: addPickToListMock })
    }
    request = {
      json: jsonMock
    } as unknown as HandlerContextWithPath<'lists', '/v1/lists/:id'>['request']
    params = { id: listId }
  })

  describe('and the request is not authenticated', () => {
    beforeEach(() => {
      verification = undefined
    })

    it('should return an unauthorized response', () => {
      return expect(createPickInListHandler({ components, verification, request, params })).resolves.toEqual({
        status: StatusCode.UNAUTHORIZED,
        body: {
          ok: false,
          message: 'Unauthorized'
        }
      })
    })
  })

  describe('and the request body does not contain a valid JSON', () => {
    beforeEach(() => {
      jsonMock.mockRejectedValueOnce(new Error())
    })

    it('should return a response with a message saying that the body must be a parsable JSON and the 400 status code', () => {
      return expect(createPickInListHandler({ components, verification, request, params })).resolves.toEqual({
        status: StatusCode.BAD_REQUEST,
        body: {
          ok: false,
          message: 'The body must contain a parsable JSON.'
        }
      })
    })
  })

  describe('and the request body does not contain the itemId property', () => {
    beforeEach(() => {
      jsonMock.mockResolvedValueOnce({})
    })

    it('should return a response with a message saying that the itemId property is not correct and the 400 status code', () => {
      return expect(createPickInListHandler({ components, verification, request, params })).resolves.toEqual({
        status: StatusCode.BAD_REQUEST,
        body: {
          ok: false,
          message: 'The property itemId is missing or is not of string type.'
        }
      })
    })
  })

  describe('and the request body does contains the itemId property but is not of string type', () => {
    beforeEach(() => {
      jsonMock.mockResolvedValueOnce({ itemId: 1 })
    })

    it('should return a response with a message saying that the itemId property is not correct and the 400 status code', () => {
      return expect(createPickInListHandler({ components, verification, request, params })).resolves.toEqual({
        status: StatusCode.BAD_REQUEST,
        body: {
          ok: false,
          message: 'The property itemId is missing or is not of string type.'
        }
      })
    })
  })

  describe('and the process to add a pick into a list fails with a list not found error', () => {
    beforeEach(() => {
      jsonMock.mockResolvedValueOnce({ itemId })
      addPickToListMock.mockRejectedValueOnce(new ListNotFoundError(listId))
    })

    it('should return a response with a message saying that the pick list was not found and the 404 status code', () => {
      return expect(createPickInListHandler({ components, verification, request, params })).resolves.toEqual({
        status: StatusCode.NOT_FOUND,
        body: {
          ok: false,
          message: 'The list was not found.',
          data: {
            listId
          }
        }
      })
    })
  })

  describe('and the process to add a pick into a list fails with a pick already exists error', () => {
    beforeEach(() => {
      jsonMock.mockResolvedValueOnce({ itemId })
      addPickToListMock.mockRejectedValueOnce(new PickAlreadyExistsError(listId, itemId))
    })

    it('should return a response with a message saying that the pick already exists and the 422 status code', () => {
      return expect(createPickInListHandler({ components, verification, request, params })).resolves.toEqual({
        status: StatusCode.UNPROCESSABLE_CONTENT,
        body: {
          ok: false,
          message: 'The item was already favorited.',
          data: {
            listId,
            itemId
          }
        }
      })
    })
  })

  describe('and the process to add a pick into a list fails with an item not found error', () => {
    beforeEach(() => {
      jsonMock.mockResolvedValueOnce({ itemId })
      addPickToListMock.mockRejectedValueOnce(new ItemNotFoundError(itemId))
    })

    it("should return a response with a message saying that the item doesn't not exist and the 404 status code", () => {
      return expect(createPickInListHandler({ components, verification, request, params })).resolves.toEqual({
        status: StatusCode.NOT_FOUND,
        body: {
          ok: false,
          message: "The item trying to get favorited doesn't exist.",
          data: {
            itemId
          }
        }
      })
    })
  })

  describe('and the process to add the picks fails with an unknown error', () => {
    const error = new Error('anError')

    beforeEach(() => {
      jsonMock.mockResolvedValueOnce({ itemId })
      addPickToListMock.mockRejectedValueOnce(error)
    })

    it('should propagate the error', () => {
      return expect(createPickInListHandler({ components, verification, request, params })).rejects.toEqual(error)
    })
  })

  describe('and the pick gets added correctly', () => {
    let pick: DBPick

    beforeEach(() => {
      pick = {
        item_id: itemId,
        list_id: listId,
        user_address: verification?.auth ?? '',
        created_at: new Date()
      }
      jsonMock.mockResolvedValueOnce({ itemId })
      addPickToListMock.mockResolvedValueOnce(pick)
    })

    it('should convert the created database pick into a pick and return it with the status 201', () => {
      return expect(createPickInListHandler({ components, verification, request, params })).resolves.toEqual({
        status: StatusCode.CREATED,
        body: {
          ok: true,
          data: {
            itemId,
            listId,
            createdAt: Number(pick.created_at),
            userAddress: verification?.auth
          }
        }
      })
    })
  })
})

describe('when deleting a pick', () => {
  let itemId: string
  let components: Pick<AppComponents, 'lists'>
  let params: HandlerContextWithPath<'lists', '/v1/lists/:id/picks/:itemId'>['params']
  let deletePickInListMock: jest.Mock

  beforeEach(() => {
    listId = 'list-id'
    itemId = 'item-id'
    deletePickInListMock = jest.fn()
    components = {
      lists: createTestListsComponent({
        deletePickInList: deletePickInListMock
      })
    }
    params = { id: listId, itemId }
  })

  describe('and the request is not authenticated', () => {
    beforeEach(() => {
      verification = undefined
    })

    it('should return an unauthorized response', () => {
      return expect(deletePickInListHandler({ components, verification, params })).resolves.toEqual({
        status: StatusCode.UNAUTHORIZED,
        body: {
          ok: false,
          message: 'Unauthorized'
        }
      })
    })
  })

  describe('and the request failed due to the pick not existing or not being accessible', () => {
    beforeEach(() => {
      deletePickInListMock.mockRejectedValueOnce(new PickNotFoundError(listId, itemId))
    })

    it('should return a not found response', () => {
      return expect(deletePickInListHandler({ components, verification, params })).resolves.toEqual({
        status: StatusCode.NOT_FOUND,
        body: {
          ok: false,
          message: 'The pick does not exist or is not accessible by this user.',
          data: {
            itemId,
            listId
          }
        }
      })
    })
  })

  describe('and the request is successful', () => {
    beforeEach(() => {
      deletePickInListMock.mockResolvedValueOnce(undefined)
    })

    it('should return an ok response', () => {
      return expect(deletePickInListHandler({ components, verification, params })).resolves.toEqual({
        status: StatusCode.OK,
        body: {
          ok: true
        }
      })
    })
  })

  describe('and the process to delete a pick fails with an unknown error', () => {
    const error = new Error('anError')

    beforeEach(() => {
      deletePickInListMock.mockRejectedValueOnce(error)
    })

    it('should propagate the error', () => {
      return expect(deletePickInListHandler({ components, verification, params })).rejects.toEqual(error)
    })
  })
})

describe('when deleting a list access', () => {
  let components: Pick<AppComponents, 'access'>
  let jsonMock: jest.Mock
  let request: HandlerContextWithPath<'lists', '/v1/lists/:id/access'>['request']
  let params: HandlerContextWithPath<'lists', '/v1/lists/:id/access'>['params']
  let deleteAccessMock: jest.Mock
  let grantee: string
  let permission: Permission

  beforeEach(() => {
    deleteAccessMock = jest.fn()
    jsonMock = jest.fn()
    components = {
      access: createTestAccessComponent({
        deleteAccess: deleteAccessMock
      })
    }
    listId = 'aListId'
    params = { id: listId }
    request = {
      json: jsonMock
    } as unknown as HandlerContextWithPath<'lists', '/v1/lists/:id/access'>['request']
  })

  describe('and the request is not authenticated', () => {
    beforeEach(() => {
      verification = undefined
    })

    it('should return an unauthorized response', () => {
      return expect(deleteAccessHandler({ components, verification, request, params })).resolves.toEqual({
        status: StatusCode.UNAUTHORIZED,
        body: {
          ok: false,
          message: 'Unauthorized'
        }
      })
    })
  })

  describe('and the request body does not contain a valid JSON', () => {
    beforeEach(() => {
      jsonMock.mockRejectedValueOnce(new Error('The body must contain a parsable JSON.'))
    })

    it('should return a response with a message saying that the body must be a parsable JSON and the 400 status code', () => {
      return expect(deleteAccessHandler({ components, verification, request, params })).resolves.toEqual({
        status: StatusCode.BAD_REQUEST,
        body: {
          ok: false,
          message: 'The body must contain a parsable JSON.'
        }
      })
    })
  })

  describe('and the body does not contain the permission', () => {
    beforeEach(() => {
      jsonMock.mockResolvedValueOnce({ grantee: '*' })
    })

    it('should return a response with a message saying that the permission is missing and the 400 status code', () => {
      return expect(deleteAccessHandler({ components, verification, request, params })).resolves.toEqual({
        status: StatusCode.BAD_REQUEST,
        body: {
          ok: false,
          message: 'The property permission is missing or is not valued as view or edit.'
        }
      })
    })
  })

  describe('and the body contains a permission that is not of value "view" or "edit"', () => {
    beforeEach(() => {
      jsonMock.mockResolvedValueOnce({ grantee: '*', permission: 'somethingElse' })
    })

    it('should return a response with a message saying that the permission must have the correct value and the 400 status code', () => {
      return expect(deleteAccessHandler({ components, verification, request, params })).resolves.toEqual({
        status: StatusCode.BAD_REQUEST,
        body: {
          ok: false,
          message: 'The property permission is missing or is not valued as view or edit.'
        }
      })
    })
  })

  describe('and the body does not contain the grantee', () => {
    beforeEach(() => {
      jsonMock.mockResolvedValueOnce({ permission: 'view' })
    })

    it('should return a response with a message saying that the grantee is missing and the 400 status code', () => {
      return expect(deleteAccessHandler({ components, verification, request, params })).resolves.toEqual({
        status: StatusCode.BAD_REQUEST,
        body: {
          ok: false,
          message: 'The property grantee is missing or is not of string type.'
        }
      })
    })
  })

  describe('and the body contains a grantee that is not of type string', () => {
    beforeEach(() => {
      jsonMock.mockResolvedValueOnce({ grantee: 1, permission: 'view' })
    })

    it('should return a response with a message saying that the grantee is not of type string and the 400 status code', () => {
      return expect(deleteAccessHandler({ components, verification, request, params })).resolves.toEqual({
        status: StatusCode.BAD_REQUEST,
        body: {
          ok: false,
          message: 'The property grantee is missing or is not of string type.'
        }
      })
    })
  })

  describe('and the body contains a grantee that is not a "*" nor an ethereum address', () => {
    beforeEach(() => {
      jsonMock.mockResolvedValueOnce({ grantee: 'x', permission: 'view' })
    })

    it('should return a response with a message saying that the grantee does not have a correct value and the 400 status code', () => {
      return expect(deleteAccessHandler({ components, verification, request, params })).resolves.toEqual({
        status: StatusCode.BAD_REQUEST,
        body: {
          ok: false,
          message: 'The property grantee is not valued as "*" or as an ethereum address.'
        }
      })
    })
  })

  describe('and the delete access procedure throws an access not found error', () => {
    let error: Error

    beforeEach(() => {
      grantee = '*'
      permission = Permission.VIEW
      jsonMock.mockResolvedValueOnce({ grantee, permission })
      error = new AccessNotFoundError(listId, permission, grantee)
      deleteAccessMock.mockRejectedValueOnce(error)
    })

    it('should return a response with a message saying that the access was not found and the 404 status code', () => {
      return expect(deleteAccessHandler({ components, verification, request, params })).resolves.toEqual({
        status: StatusCode.NOT_FOUND,
        body: {
          ok: false,
          message: error.message,
          data: {
            listId,
            permission,
            grantee
          }
        }
      })
    })
  })

  describe('and the delete procedure throws an unknown error', () => {
    let error: Error

    beforeEach(() => {
      grantee = '*'
      permission = Permission.VIEW
      error = new Error('An error occurred')
      jsonMock.mockResolvedValueOnce({ grantee, permission })
      deleteAccessMock.mockRejectedValueOnce(error)
    })

    it('should propagate the error', () => {
      return expect(deleteAccessHandler({ components, verification, request, params })).rejects.toEqual(error)
    })
  })

  describe('and the delete procedure is successful', () => {
    let result: unknown

    beforeEach(async () => {
      grantee = '*'
      permission = Permission.VIEW
      jsonMock.mockResolvedValueOnce({ grantee, permission })
      deleteAccessMock.mockResolvedValueOnce(undefined)
      result = await deleteAccessHandler({ components, verification, request, params })
    })

    it('should return a response without data and a 200 status code', () => {
      expect(result).toEqual({
        status: StatusCode.OK,
        body: {
          ok: true
        }
      })
    })

    it('should have called the delete access procedure with the given parameters', () => {
      expect(deleteAccessMock).toHaveBeenCalledWith(listId, permission, grantee, verification?.auth)
    })
  })
})

describe('when creating an access', () => {
  let components: Pick<AppComponents, 'access'>
  let jsonMock: jest.Mock
  let request: HandlerContextWithPath<'lists', '/v1/lists/:id/access'>['request']
  let params: HandlerContextWithPath<'lists', '/v1/lists/:id/access'>['params']
  let createAccessMock: jest.Mock
  let grantee: string
  let permission: Permission

  beforeEach(() => {
    createAccessMock = jest.fn()
    jsonMock = jest.fn()
    components = {
      access: createTestAccessComponent({
        createAccess: createAccessMock
      })
    }
    listId = 'aListId'
    params = { id: listId }
    request = {
      json: jsonMock
    } as unknown as HandlerContextWithPath<'lists', '/v1/lists/:id/access'>['request']
  })

  describe('and the request is not authenticated', () => {
    beforeEach(() => {
      verification = undefined
    })

    it('should return an unauthorized response', () => {
      return expect(createAccessHandler({ components, verification, request, params })).resolves.toEqual({
        status: StatusCode.UNAUTHORIZED,
        body: {
          ok: false,
          message: 'Unauthorized'
        }
      })
    })
  })

  describe('and the request body does not contain a valid JSON', () => {
    beforeEach(() => {
      jsonMock.mockRejectedValueOnce(new Error('The body must contain a parsable JSON.'))
    })

    it('should return a response with a message saying that the body must be a parsable JSON and the 400 status code', () => {
      return expect(createAccessHandler({ components, verification, request, params })).resolves.toEqual({
        status: StatusCode.BAD_REQUEST,
        body: {
          ok: false,
          message: 'The body must contain a parsable JSON.'
        }
      })
    })
  })

  describe('and the body does not contain the permission', () => {
    beforeEach(() => {
      grantee = '*'
      jsonMock.mockResolvedValueOnce({ grantee })
    })

    it('should return a response with a message saying that the permission is missing and the 400 status code', () => {
      return expect(createAccessHandler({ components, verification, request, params })).resolves.toEqual({
        status: StatusCode.BAD_REQUEST,
        body: {
          ok: false,
          message: 'The property permission is missing or is not valued as view or edit.'
        }
      })
    })
  })

  describe('and the body contains a permission that is not of value "view" or "edit"', () => {
    beforeEach(() => {
      grantee = '*'
      permission = 'somethingElse' as Permission
      jsonMock.mockResolvedValueOnce({ grantee, permission })
    })

    it('should return a response with a message saying that the permission must have the correct value and the 400 status code', () => {
      return expect(createAccessHandler({ components, verification, request, params })).resolves.toEqual({
        status: StatusCode.BAD_REQUEST,
        body: {
          ok: false,
          message: 'The property permission is missing or is not valued as view or edit.'
        }
      })
    })
  })

  describe('and the body does not contain the grantee', () => {
    beforeEach(() => {
      permission = Permission.VIEW
      jsonMock.mockResolvedValueOnce({ permission })
    })

    it('should return a response with a message saying that the grantee is missing and the 400 status code', () => {
      return expect(createAccessHandler({ components, verification, request, params })).resolves.toEqual({
        status: StatusCode.BAD_REQUEST,
        body: {
          ok: false,
          message: 'The property grantee is missing or is not of string type.'
        }
      })
    })
  })

  describe('and the body contains a grantee that is not of type string', () => {
    beforeEach(() => {
      permission = Permission.VIEW
      grantee = 1 as unknown as string
      jsonMock.mockResolvedValueOnce({ grantee: 1, permission })
    })

    it('should return a response with a message saying that the grantee is not of type string and the 400 status code', () => {
      return expect(createAccessHandler({ components, verification, request, params })).resolves.toEqual({
        status: StatusCode.BAD_REQUEST,
        body: {
          ok: false,
          message: 'The property grantee is missing or is not of string type.'
        }
      })
    })
  })

  describe('and the body contains a grantee that is not a "*" nor an ethereum address', () => {
    beforeEach(() => {
      grantee = 'x'
      permission = Permission.VIEW
      jsonMock.mockResolvedValueOnce({ grantee, permission })
    })

    it('should return a response with a message saying that the grantee does not have a correct value and the 400 status code', () => {
      return expect(createAccessHandler({ components, verification, request, params })).resolves.toEqual({
        status: StatusCode.BAD_REQUEST,
        body: {
          ok: false,
          message: 'The property grantee is not valued as "*" or as an ethereum address.'
        }
      })
    })
  })

  describe('and the create access procedure throws a list not found error', () => {
    beforeEach(() => {
      grantee = '*'
      permission = Permission.VIEW
      jsonMock.mockResolvedValueOnce({ grantee, permission })
      createAccessMock.mockRejectedValueOnce(new ListNotFoundError(listId))
    })

    it('should return a response with a message saying that the list was not found and the 404 status code', () => {
      return expect(createAccessHandler({ components, verification, request, params })).resolves.toEqual({
        status: StatusCode.NOT_FOUND,
        body: {
          ok: false,
          message: 'The list was not found.',
          data: {
            listId
          }
        }
      })
    })
  })

  describe('and the create access procedure throws a duplicated access error', () => {
    beforeEach(() => {
      grantee = '*'
      permission = Permission.VIEW
      jsonMock.mockResolvedValueOnce({ grantee, permission })
      createAccessMock.mockRejectedValueOnce(new DuplicatedAccessError(listId, permission, grantee))
    })

    it('should return a response with a message saying that the access already exists and the 409 status code', () => {
      return expect(createAccessHandler({ components, verification, request, params })).resolves.toEqual({
        status: StatusCode.CONFLICT,
        body: {
          ok: false,
          message: 'The access already exists for the given list.',
          data: {
            listId,
            grantee,
            permission
          }
        }
      })
    })
  })

  describe('and the create procedure throws an unknown error', () => {
    let error: Error

    beforeEach(() => {
      grantee = '*'
      permission = Permission.VIEW
      error = new Error('An error occurred')
      jsonMock.mockResolvedValueOnce({ grantee, permission })
      createAccessMock.mockRejectedValueOnce(error)
    })

    it('should propagate the error', () => {
      return expect(createAccessHandler({ components, verification, request, params })).rejects.toEqual(error)
    })
  })

  describe('and the create procedure is successful', () => {
    let result: unknown

    beforeEach(async () => {
      grantee = '*'
      permission = Permission.VIEW
      jsonMock.mockResolvedValueOnce({ grantee, permission })
      createAccessMock.mockResolvedValueOnce(undefined)
      result = await createAccessHandler({ components, verification, request, params })
    })

    it('should return a response without data and a 201 status code', () => {
      expect(result).toEqual({
        status: StatusCode.CREATED,
        body: {
          ok: true
        }
      })
    })

    it('should have called the create access procedure with the given parameters', () => {
      expect(createAccessMock).toHaveBeenCalledWith(listId, permission, grantee, verification?.auth)
    })
  })
})

describe('when getting the lists', () => {
  let url: URL
  let components: Pick<AppComponents, 'lists'>
  let getListsMock: jest.Mock

  beforeEach(() => {
    getListsMock = jest.fn()
    components = {
      lists: createTestListsComponent({
        getLists: getListsMock
      })
    }
    url = new URL('http://localhost/v1/lists')
  })

  describe('and the request is not authenticated', () => {
    beforeEach(() => {
      verification = undefined
    })

    it('should return an unauthorized response', () => {
      return expect(
        getListsHandler({
          url,
          components,
          verification
        })
      ).resolves.toEqual({
        status: StatusCode.UNAUTHORIZED,
        body: {
          ok: false,
          message: 'Unauthorized',
          data: undefined
        }
      })
    })
  })

  describe('and the sort by parameter has an incorrect value', () => {
    beforeEach(() => {
      url = new URL('http://localhost/v1/lists?sortBy=incorrectValue')
    })

    it('should return a bad request response', () => {
      return expect(
        getListsHandler({
          url,
          components,
          verification
        })
      ).resolves.toEqual({
        status: StatusCode.BAD_REQUEST,
        body: {
          ok: false,
          message: 'The sort by parameter is not defined as date or name.',
          data: undefined
        }
      })
    })
  })

  describe('and the sort direction parameter has an incorrect value', () => {
    beforeEach(() => {
      url = new URL('http://localhost/v1/lists?sortBy=name&sortDirection=incorrectValue')
    })

    it('should return a bad request response', () => {
      return expect(
        getListsHandler({
          url,
          components,
          verification
        })
      ).resolves.toEqual({
        status: StatusCode.BAD_REQUEST,
        body: {
          ok: false,
          message: 'The sort direction parameter is not defined as asc or desc.',
          data: undefined
        }
      })
    })
  })

  describe('and the process to get the lists fails', () => {
    let error: Error

    beforeEach(() => {
      error = new Error('anError')
      getListsMock.mockRejectedValueOnce(error)
    })

    it('should propagate the error', () => {
      return expect(
        getListsHandler({
          url,
          components,
          verification
        })
      ).rejects.toEqual(error)
    })
  })

  describe('and the process to get the lists is successful', () => {
    let dbLists: DBGetListsWithCount[]
    let lists: Pick<List, 'id' | 'name'>[]

    beforeEach(() => {
      dbLists = [
        {
          id: 'e96df126-f5bf-4311-94d8-6e261f368bb2',
          name: 'List #1',
          description: 'Description of List #1',
          user_address: '0x45abb534BD927284F84b03d43f33dF0E5C91C21f',
          created_at: new Date(),
          lists_count: '1'
        }
      ]
      lists = [{ id: 'e96df126-f5bf-4311-94d8-6e261f368bb2', name: 'List #1' }]
      getListsMock.mockResolvedValueOnce(dbLists)
    })

    it('should return a response with an ok status code and the lists', () => {
      return expect(
        getListsHandler({
          url,
          components,
          verification
        })
      ).resolves.toEqual({
        status: StatusCode.OK,
        body: {
          ok: true,
          data: {
            results: lists,
            total: 1,
            page: 0,
            pages: 1,
            limit: 100
          }
        }
      })
    })
  })
})

describe('when creating a list', () => {
  let name: string
  let request: HandlerContextWithPath<'lists', '/v1/lists'>['request']
  let components: Pick<AppComponents, 'lists'>
  let jsonMock: jest.Mock
  let addListMock: jest.Mock

  beforeEach(() => {
    name = 'Test List'
    jsonMock = jest.fn()
    addListMock = jest.fn()
    components = {
      lists: createTestListsComponent({ addList: addListMock })
    }
    request = {
      json: jsonMock
    } as unknown as HandlerContextWithPath<'lists', '/v1/lists'>['request']
  })

  describe('and the request is not authenticated', () => {
    beforeEach(() => {
      verification = undefined
    })

    it('should return an unauthorized response', () => {
      return expect(createListHandler({ components, verification, request })).resolves.toEqual({
        status: StatusCode.UNAUTHORIZED,
        body: {
          ok: false,
          message: 'Unauthorized'
        }
      })
    })
  })

  describe('and the request body does not contain a valid JSON', () => {
    beforeEach(() => {
      jsonMock.mockRejectedValueOnce(new Error())
    })

    it('should return a response with a message saying that the body must be a parsable JSON and the 400 status code', () => {
      return expect(createListHandler({ components, verification, request })).resolves.toEqual({
        status: StatusCode.BAD_REQUEST,
        body: {
          ok: false,
          message: 'The body must contain a parsable JSON.'
        }
      })
    })
  })

  describe('and the request body does not contain the name property', () => {
    beforeEach(() => {
      jsonMock.mockResolvedValueOnce({})
    })

    it('should return a response with a message saying that the name property is not correct and the 400 status code', () => {
      return expect(createListHandler({ components, verification, request })).resolves.toEqual({
        status: StatusCode.BAD_REQUEST,
        body: {
          ok: false,
          message: 'The property name is missing or is not of string type.'
        }
      })
    })
  })

  describe('and the request body does contains the name property but is not of string type', () => {
    beforeEach(() => {
      jsonMock.mockResolvedValueOnce({ name: 1 })
    })

    it('should return a response with a message saying that the name property is not correct and the 400 status code', () => {
      return expect(createListHandler({ components, verification, request })).resolves.toEqual({
        status: StatusCode.BAD_REQUEST,
        body: {
          ok: false,
          message: 'The property name is missing or is not of string type.'
        }
      })
    })
  })

  describe('and the process to add a list fails with a duplicated list name error', () => {
    beforeEach(() => {
      jsonMock.mockResolvedValueOnce({ name })
      addListMock.mockRejectedValueOnce(new DuplicatedListError(name))
    })

    it('should return a response with a message saying that the list name is duplicated and the 422 status code', () => {
      return expect(createListHandler({ components, verification, request })).resolves.toEqual({
        status: StatusCode.UNPROCESSABLE_CONTENT,
        body: {
          ok: false,
          message: `There is already a list with the same name: ${name}.`,
          data: {
            name
          }
        }
      })
    })
  })

  describe('and the process to add a list fails with an unknown error', () => {
    const error = new Error('anError')

    beforeEach(() => {
      jsonMock.mockResolvedValueOnce({ name })
      addListMock.mockRejectedValueOnce(error)
    })

    it('should propagate the error', () => {
      return expect(createListHandler({ components, verification, request })).rejects.toEqual(error)
    })
  })

  describe('and the list gets added correctly', () => {
    let list: DBList
    const date = new Date()

    beforeEach(() => {
      list = {
        id: listId,
        name,
        user_address: verification?.auth ?? '',
        created_at: date,
        description: null
      }
      jsonMock.mockResolvedValueOnce({ name })
      addListMock.mockResolvedValueOnce(list)
    })

    it('should convert the created database list into a list and return it with the status 201', () => {
      return expect(createListHandler({ components, verification, request })).resolves.toEqual({
        status: StatusCode.CREATED,
        body: {
          ok: true,
          data: {
            id: listId,
            name,
            userAddress: verification?.auth,
            createdAt: date,
            description: null,
            permission: undefined
          }
        }
      })
    })
  })
})

describe('when getting a list', () => {
  let params: HandlerContextWithPath<'lists', '/v1/lists/:id'>['params']
  let components: Pick<AppComponents, 'lists'>
  let getListMock: jest.Mock
  let dbList: DBList
  let list: List

  const date = new Date()

  beforeEach(() => {
    listId = 'list-id'
    getListMock = jest.fn()
    components = {
      lists: createTestListsComponent({
        getList: getListMock
      })
    }
    params = { id: listId }

    dbList = {
      id: listId,
      name: 'Test List',
      description: 'Description of List #1',
      user_address: '0x45abb534BD927284F84b03d43f33dF0E5C91C21f',
      created_at: date
    }

    list = {
      id: listId,
      name: 'Test List',
      userAddress: '0x45abb534BD927284F84b03d43f33dF0E5C91C21f',
      createdAt: date,
      description: 'Description of List #1',
      permission: undefined
    }
  })

  describe('and the request failed due to the list not existing or not being accessible', () => {
    let error: Error

    beforeEach(() => {
      error = new ListNotFoundError(listId)
      getListMock.mockRejectedValueOnce(error)
    })

    it('should return a not found response', () => {
      return expect(getListHandler({ components, verification, params })).resolves.toEqual({
        status: StatusCode.NOT_FOUND,
        body: {
          ok: false,
          message: error.message,
          data: {
            listId
          }
        }
      })
    })
  })

  describe('and the request is successful because the user has %s permission to access the list', () => {
    let permission: Permission

    beforeEach(() => {
      permission = Permission.VIEW
      dbList = { ...dbList, permission }
      list = { ...list, permission }
      getListMock.mockResolvedValueOnce(dbList)
    })

    it('should return an ok response with the list', () => {
      return expect(getListHandler({ components, verification, params })).resolves.toEqual({
        status: StatusCode.OK,
        body: {
          ok: true,
          data: list
        }
      })
    })
  })

  describe('and the process to get a list fails with an unknown error', () => {
    const error = new Error('anError')

    beforeEach(() => {
      getListMock.mockRejectedValueOnce(error)
    })

    it('should propagate the error', () => {
      return expect(getListHandler({ components, verification, params })).rejects.toEqual(error)
    })
  })
})

describe('when deleting a list', () => {
  let request: HandlerContextWithPath<'lists', '/v1/lists/:id'>['request']
  let params: HandlerContextWithPath<'lists', '/v1/lists/:id'>['params']
  let components: Pick<AppComponents, 'lists'>
  let deleteListMock: jest.Mock

  beforeEach(() => {
    listId = 'list-id'
    deleteListMock = jest.fn()
    components = {
      lists: createTestListsComponent({
        deleteList: deleteListMock
      })
    }
    request = {} as HandlerContextWithPath<'lists', '/v1/lists/:id'>['request']
    params = { id: listId }
  })

  describe('and the request is not authenticated', () => {
    beforeEach(() => {
      verification = undefined
    })

    it('should return an unauthorized response', () => {
      return expect(deleteListHandler({ components, verification, request, params })).resolves.toEqual({
        status: StatusCode.UNAUTHORIZED,
        body: {
          ok: false,
          message: 'Unauthorized'
        }
      })
    })
  })

  describe('and the request failed due to the list not existing or not being accessible', () => {
    beforeEach(() => {
      deleteListMock.mockRejectedValueOnce(new ListNotFoundError(listId))
    })

    it('should return a not found response', () => {
      return expect(deleteListHandler({ components, verification, request, params })).resolves.toEqual({
        status: StatusCode.NOT_FOUND,
        body: {
          ok: false,
          message: 'The list was not found.',
          data: {
            listId
          }
        }
      })
    })
  })

  describe('and the request is successful', () => {
    beforeEach(() => {
      deleteListMock.mockResolvedValueOnce(undefined)
    })

    it('should return an ok response', () => {
      return expect(deleteListHandler({ components, verification, request, params })).resolves.toEqual({
        status: StatusCode.OK,
        body: {
          ok: true
        }
      })
    })
  })

  describe('and the process to delete a list fails with an unknown error', () => {
    const error = new Error('anError')

    beforeEach(() => {
      deleteListMock.mockRejectedValueOnce(error)
    })

    it('should propagate the error', () => {
      return expect(deleteListHandler({ components, verification, request, params })).rejects.toEqual(error)
    })
  })
})
