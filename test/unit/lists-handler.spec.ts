import * as authorizationMiddleware from 'decentraland-crypto-middleware'
import { List } from '../../src/adapters/lists'
import { TPick } from '../../src/adapters/picks'
import {
  createPickInListHandler,
  deletePickInListHandler,
  getPicksByListIdHandler,
  getListsHandler
} from '../../src/controllers/handlers/lists-handlers'
import { DBGetListsWithCount } from '../../src/ports/lists'
import { ItemNotFoundError, ListNotFoundError, PickAlreadyExistsError, PickNotFoundError } from '../../src/ports/lists/errors'
import { DBGetFilteredPicksWithCount, DBPick } from '../../src/ports/picks'
import { AppComponents, HandlerContextWithPath, StatusCode } from '../../src/types'
import { createTestListsComponent } from '../components'

let verification: authorizationMiddleware.DecentralandSignatureData | undefined
let components: Pick<AppComponents, 'lists'>
let listId: string

beforeEach(() => {
  verification = { auth: '0x0', authMetadata: {} }
})

describe('when getting the picks of a list', () => {
  let url: URL
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
    } as any
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
          message: 'The favorites list was not found.',
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
  let request: HandlerContextWithPath<'lists', '/v1/lists/:id/picks/:itemId'>['request']
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
    request = {} as HandlerContextWithPath<'lists', '/v1/lists/:id/picks'>['request']
    params = { id: listId, itemId }
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

  describe('and the request failed due to the pick not existing or not being accessible', () => {
    beforeEach(() => {
      deletePickInListMock.mockRejectedValueOnce(new PickNotFoundError(listId, itemId))
    })

    it('should return a not found response', () => {
      return expect(deletePickInListHandler({ components, verification, request, params })).resolves.toEqual({
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
      return expect(deletePickInListHandler({ components, verification, request, params })).resolves.toEqual({
        status: StatusCode.OK,
        body: {
          ok: true
        }
      })
    })
  })

  describe('and the process to add the picks fails with an unknown error', () => {
    const error = new Error('anError')

    beforeEach(() => {
      deletePickInListMock.mockRejectedValueOnce(error)
    })

    it('should propagate the error', () => {
      return expect(deletePickInListHandler({ components, verification, request, params })).rejects.toEqual(error)
    })
  })
})

describe('when getting the lists', () => {
  let url: URL
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
