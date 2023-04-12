import { IDatabase, ILoggerComponent } from '@well-known-components/interfaces'
import { IPgComponent } from '@well-known-components/pg-component'
import { ISubgraphComponent } from '@well-known-components/thegraph-component'
import { createListsComponent, IListsComponents } from '../../src/ports/lists'
import { ItemNotFoundError, ListNotFoundError, PickAlreadyExistsError, PickNotFoundError, QueryFailure } from '../../src/ports/lists/errors'
import { DBGetFilteredPicksWithCount, DBPick } from '../../src/ports/picks'
import { ISnapshotComponent } from '../../src/ports/snapshot'
import { createTestSnapshotComponent, createTestPgComponent, createTestSubgraphComponent, createTestLogsComponent } from '../components'

let listId: string
let itemId: string
let userAddress: string
let dbQueryMock: jest.Mock
let dbClientQueryMock: jest.Mock
let dbClientReleaseMock: jest.Mock
let getScoreMock: jest.Mock
let collectionsSubgraphQueryMock: jest.Mock
let pg: IPgComponent & IDatabase
let listsComponent: IListsComponents
let collectionsSubgraph: ISubgraphComponent
let snapshot: ISnapshotComponent
let logs: ILoggerComponent

// TODO: handle the following eslint-disable statement
// eslint-disable-next-line @typescript-eslint/require-await
beforeEach(async () => {
  dbQueryMock = jest.fn()
  collectionsSubgraphQueryMock = jest.fn()
  getScoreMock = jest.fn()
  dbClientQueryMock = jest.fn()
  dbClientReleaseMock = jest.fn().mockResolvedValue(undefined)
  pg = createTestPgComponent({
    query: dbQueryMock,
    getPool: jest.fn().mockReturnValue({
      connect: () => ({
        query: dbClientQueryMock,
        release: dbClientReleaseMock
      })
    })
  })
  logs = createTestLogsComponent({
    getLogger: jest.fn().mockReturnValue({ error: () => undefined, info: () => undefined })
  })
  snapshot = createTestSnapshotComponent({ getScore: getScoreMock })
  collectionsSubgraph = createTestSubgraphComponent({
    query: collectionsSubgraphQueryMock
  })
  listsComponent = createListsComponent({
    pg,
    collectionsSubgraph,
    logs,
    snapshot
  })
  listId = '99ffdcd4-0647-41e7-a865-996e2071ed62'
  itemId = '0x08de0de733cc11081d43569b809c00e6ddf314fb-0'
  userAddress = '0x1dec5f50cb1467f505bb3ddfd408805114406b10'
})

describe('when getting picks from a list by list id', () => {
  let dbGetPicksByListId: DBGetFilteredPicksWithCount[]

  describe('and the query throws an error', () => {
    const errorMessage = 'Something went wrong while querying the database'

    beforeEach(() => {
      dbQueryMock.mockRejectedValueOnce(new Error(errorMessage))
    })

    it('should propagate the error', () => {
      // TODO: handle the following eslint-disable statement
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      expect(
        listsComponent.getPicksByListId('list-id', {
          offset: 0,
          limit: 10,
          userAddress: '0xuseraddress'
        })
      ).rejects.toThrowError(errorMessage)
    })
  })

  describe('and the list id, limit, offset, and user address are all set', () => {
    beforeEach(() => {
      dbGetPicksByListId = []
      dbQueryMock.mockResolvedValueOnce({ rows: dbGetPicksByListId })
    })

    it('should have made the query to get the picks matching those conditions', async () => {
      await expect(
        listsComponent.getPicksByListId('list-id', {
          offset: 0,
          limit: 10,
          userAddress: '0xuseraddress'
        })
      ).resolves.toEqual(dbGetPicksByListId)
      expect(dbQueryMock).toBeCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('WHERE list_id = $1 AND user_address = $2'),
          values: expect.arrayContaining(['list-id', '0xuseraddress'])
        })
      )

      expect(dbQueryMock).toBeCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('LIMIT $3 OFFSET $4'),
          values: expect.arrayContaining([10, 0])
        })
      )
    })
  })
})

describe('when creating a new pick', () => {
  describe("and the user isn't allowed to create a new pick on the given list or the list doesn't exist", () => {
    let error: Error

    beforeEach(() => {
      error = new ListNotFoundError(listId)
      dbQueryMock.mockRejectedValueOnce(error)
    })

    it('should throw a list not found error', () => {
      return expect(listsComponent.addPickToList(listId, itemId, userAddress)).rejects.toEqual(error)
    })
  })

  describe('and the collections subgraph query fails', () => {
    beforeEach(() => {
      dbQueryMock.mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            id: 'aListId',
            name: 'aListName',
            description: null,
            user_address: 'aUserAddress'
          }
        ]
      })
      collectionsSubgraphQueryMock.mockRejectedValueOnce(new Error('anError'))
    })

    it('should throw an error saying that the request failed', () => {
      return expect(listsComponent.addPickToList(listId, itemId, userAddress)).rejects.toEqual(new QueryFailure('anError'))
    })
  })

  describe("and the item being picked doesn't exist", () => {
    beforeEach(() => {
      dbQueryMock.mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            id: 'aListId',
            name: 'aListName',
            description: null,
            user_address: 'aUserAddress'
          }
        ]
      })
      getScoreMock.mockResolvedValueOnce(10)
      collectionsSubgraphQueryMock.mockResolvedValueOnce({ items: [] })
    })

    it('should throw an item not found error', () => {
      return expect(listsComponent.addPickToList(listId, itemId, userAddress)).rejects.toEqual(new ItemNotFoundError(itemId))
    })
  })

  describe('and the item being picked exists and the user is allowed to create a new pick on the given list', () => {
    beforeEach(() => {
      collectionsSubgraphQueryMock.mockResolvedValueOnce({
        items: [{ id: itemId }]
      })
      dbQueryMock.mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            id: listId,
            name: 'aListName',
            description: null,
            user_address: userAddress
          }
        ]
      })
      // Begin Query
      dbClientQueryMock.mockResolvedValueOnce(undefined)
    })

    describe('and the pick already exists', () => {
      beforeEach(() => {
        // Insert pick mock
        dbClientQueryMock.mockRejectedValueOnce({
          constraint: 'item_id_user_address_list_id_primary_key'
        })
        // Insert vp mock
        dbClientQueryMock.mockResolvedValueOnce(undefined)
      })

      it('should rollback the changes and release the client and throw a pick already exists error', async () => {
        await expect(listsComponent.addPickToList(listId, itemId, userAddress)).rejects.toEqual(new PickAlreadyExistsError(listId, itemId))
        expect(dbClientQueryMock).toHaveBeenCalledWith('ROLLBACK')
        expect(dbClientReleaseMock).toHaveBeenCalled()
      })
    })

    describe('and the pick does not exist already', () => {
      let dbPick: DBPick
      let result: DBPick

      // TODO: handle the following eslint-disable statement
      // eslint-disable-next-line @typescript-eslint/require-await
      beforeEach(async () => {
        dbPick = {
          item_id: itemId,
          user_address: userAddress,
          list_id: listId,
          created_at: new Date()
        }
        dbClientQueryMock.mockResolvedValueOnce({
          rowCount: 1,
          rows: [dbPick]
        })
      })

      describe('and the request to get the voting power failed', () => {
        beforeEach(async () => {
          getScoreMock.mockRejectedValueOnce(new Error())
          result = await listsComponent.addPickToList(listId, itemId, userAddress)
        })

        it('should create the pick', () => {
          expect(dbClientQueryMock).toHaveBeenCalledWith(
            expect.objectContaining({
              strings: expect.arrayContaining([expect.stringContaining('INSERT INTO favorites.picks (item_id, user_address, list_id)')]),
              values: [itemId, userAddress, listId]
            })
          )
        })

        it('should insert the voting power as 0 without overwriting it', () => {
          expect(dbClientQueryMock).toHaveBeenCalledWith(
            expect.objectContaining({
              strings: expect.arrayContaining([expect.stringContaining('INSERT INTO favorites.voting (user_address, power) VALUES')]),
              values: [userAddress, 0]
            })
          )

          expect(dbClientQueryMock).toHaveBeenCalledWith(
            expect.objectContaining({
              strings: expect.arrayContaining([expect.stringContaining('ON CONFLICT (user_address) DO NOTHING')])
            })
          )
        })

        it('should resolve with the new pick', () => {
          expect(result).toEqual(dbPick)
        })

        it('should commit the changes and release the client', () => {
          expect(dbClientQueryMock).toHaveBeenCalledWith('COMMIT')
          expect(dbClientReleaseMock).toHaveBeenCalled()
        })
      })

      describe('and the request to get the voting power was successful', () => {
        beforeEach(async () => {
          getScoreMock.mockResolvedValueOnce(10)
          result = await listsComponent.addPickToList(listId, itemId, userAddress)
        })

        it('should create the pick', () => {
          expect(dbClientQueryMock).toHaveBeenCalledWith(
            expect.objectContaining({
              strings: expect.arrayContaining([expect.stringContaining('INSERT INTO favorites.picks (item_id, user_address, list_id)')]),
              values: [itemId, userAddress, listId]
            })
          )
        })

        it('should insert the voting power or overwrite it', () => {
          expect(dbClientQueryMock).toHaveBeenCalledWith(
            expect.objectContaining({
              strings: expect.arrayContaining([expect.stringContaining('INSERT INTO favorites.voting (user_address, power) VALUES')]),
              values: [userAddress, 10, 10]
            })
          )

          expect(dbClientQueryMock).toHaveBeenCalledWith(
            expect.objectContaining({
              strings: expect.arrayContaining([expect.stringContaining('ON CONFLICT (user_address) DO UPDATE SET power =')])
            })
          )
        })

        it('should resolve with the new pick', () => {
          expect(result).toEqual(dbPick)
        })

        it('should commit the changes and release the client', () => {
          expect(dbClientQueryMock).toHaveBeenCalledWith('COMMIT')
          expect(dbClientReleaseMock).toHaveBeenCalled()
        })
      })
    })
  })
})

describe('when deleting a pick', () => {
  describe('and the pick was not found or was not accessible by the user', () => {
    let error: Error

    beforeEach(() => {
      error = new PickNotFoundError(listId, itemId)
      dbQueryMock.mockResolvedValueOnce({ rowCount: 0 })
    })

    it('should throw a pick not found error', () => {
      return expect(listsComponent.deletePickInList(listId, itemId, userAddress)).rejects.toEqual(error)
    })
  })

  describe('and the pick was successfully deleted', () => {
    beforeEach(() => {
      dbQueryMock.mockResolvedValueOnce({ rowCount: 1 })
    })

    it('should resolve', () => {
      return expect(listsComponent.deletePickInList(listId, itemId, userAddress)).resolves.toEqual(undefined)
    })
  })
})
