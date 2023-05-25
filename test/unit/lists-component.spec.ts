import { IDatabase, ILoggerComponent } from '@well-known-components/interfaces'
import { ISubgraphComponent } from '@well-known-components/thegraph-component'
import { DEFAULT_LIST_USER_ADDRESS } from '../../src/migrations/1678303321034_default-list'
import { Permission } from '../../src/ports/access'
import { AccessNotFoundError, DuplicatedAccessError } from '../../src/ports/access/errors'
import {
  createListsComponent,
  DBGetListsWithCount,
  DBList,
  IListsComponents,
  ListSortBy,
  ListSortDirection,
  UpdateListRequestBody
} from '../../src/ports/lists'
import {
  DuplicatedListError,
  ItemNotFoundError,
  ListNotFoundError,
  PickAlreadyExistsError,
  PickNotFoundError,
  QueryFailure
} from '../../src/ports/lists/errors'
import { IPgComponent } from '../../src/ports/pg'
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

beforeEach(() => {
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
    }),
    withTransaction: jest.fn().mockImplementation(async (callback, onError) => {
      try {
        const results = await callback({
          query: dbClientQueryMock,
          release: dbClientReleaseMock
        })
        return results
      } catch (error) {
        await onError(error)
        throw error
      }
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
          strings: expect.arrayContaining([
            expect.stringContaining('WHERE p.list_id ='),
            expect.stringContaining('AND (p.user_address ='),
            expect.stringContaining('OR favorites.acl.grantee ='),
            expect.stringContaining('OR favorites.acl.grantee =')
          ]),
          values: expect.arrayContaining(['list-id', '0xuseraddress', '0xuseraddress', '*'])
        })
      )

      expect(dbQueryMock).toBeCalledWith(
        expect.objectContaining({
          strings: expect.arrayContaining([expect.stringContaining('LIMIT'), expect.stringContaining('OFFSET')]),
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
            user_address: 'aUserAddress',
            permission: Permission.EDIT
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
            user_address: 'aUserAddress',
            permission: Permission.EDIT
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
            user_address: userAddress,
            permission: Permission.EDIT
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

      beforeEach(() => {
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

describe('when getting lists', () => {
  let dbGetLists: DBGetListsWithCount[]

  describe('and the query throws an error', () => {
    const errorMessage = 'Something went wrong while querying the database'

    beforeEach(() => {
      dbQueryMock.mockRejectedValueOnce(new Error(errorMessage))
    })

    it('should propagate the error', () => {
      expect(
        listsComponent.getLists({
          offset: 0,
          limit: 10,
          userAddress: '0xuseraddress'
        })
      ).rejects.toThrowError(errorMessage)
    })
  })

  describe('and the limit, offset, and user address are all set', () => {
    beforeEach(() => {
      dbGetLists = []
      dbQueryMock.mockResolvedValueOnce({ rows: dbGetLists })
    })

    describe('and the sorting parameters are not set', () => {
      it('should have made the query to get the lists using the default sorting parameters', async () => {
        await expect(
          listsComponent.getLists({
            offset: 0,
            limit: 10,
            userAddress: '0xuseraddress'
          })
        ).resolves.toEqual(dbGetLists)

        expect(dbQueryMock).toBeCalledWith(
          expect.objectContaining({
            text: expect.stringContaining('LEFT JOIN favorites.picks p ON l.id = p.list_id AND p.user_address = $2'),
            values: expect.arrayContaining(['0xuseraddress'])
          })
        )

        expect(dbQueryMock).toBeCalledWith(
          expect.objectContaining({
            text: expect.stringContaining('WHERE l.user_address = $3 OR l.user_address = $4'),
            values: expect.arrayContaining(['0xuseraddress', DEFAULT_LIST_USER_ADDRESS])
          })
        )

        expect(dbQueryMock).toBeCalledWith(
          expect.objectContaining({
            text: expect.stringContaining('ORDER BY is_default_list DESC, l.created_at $5'),
            values: expect.arrayContaining([ListSortDirection.DESC])
          })
        )

        expect(dbQueryMock).toBeCalledWith(
          expect.objectContaining({
            text: expect.stringContaining('LIMIT $6 OFFSET $7'),
            values: expect.arrayContaining([10, 0])
          })
        )
      })
    })

    describe('and the item id parameter is set', () => {
      let itemId: string

      beforeEach(() => {
        itemId = '0x08de0de733cc11081d43569b809c00e6ddf314fb-0'
      })

      it('should have made the query to get the lists taking into account if the item is in the list', async () => {
        await expect(
          listsComponent.getLists({
            offset: 0,
            limit: 10,
            userAddress: '0xuseraddress',
            itemId
          })
        ).resolves.toEqual(dbGetLists)

        expect(dbQueryMock).toBeCalledWith(
          expect.objectContaining({
            text: expect.stringContaining(', MAX(CASE WHEN p.item_id = $2 THEN 1 ELSE 0 END)::BOOLEAN AS is_item_in_list'),
            values: expect.arrayContaining([itemId])
          })
        )
      })
    })

    describe('and the q parameter is set', () => {
      let q: string

      beforeEach(() => {
        q = 'aName'
      })

      it('should have made the query to get the lists searching by the list names', async () => {
        await expect(
          listsComponent.getLists({
            offset: 0,
            limit: 10,
            userAddress: '0xuseraddress',
            q
          })
        ).resolves.toEqual(dbGetLists)

        expect(dbQueryMock).toBeCalledWith(
          expect.objectContaining({
            text: expect.stringContaining("AND l.name ILIKE '%$5%'"),
            values: expect.arrayContaining([q])
          })
        )
      })
    })

    describe('and the sorting parameters are set', () => {
      describe('and the sort by is "date"', () => {
        describe.each([ListSortDirection.ASC, ListSortDirection.DESC])('and the sort direction is "%s"', sortDirection => {
          it('should have made the query to get the lists matching those conditions', async () => {
            await expect(
              listsComponent.getLists({
                offset: 0,
                limit: 10,
                userAddress: '0xuseraddress',
                sortBy: ListSortBy.CREATED_AT,
                sortDirection
              })
            ).resolves.toEqual(dbGetLists)

            expect(dbQueryMock).toBeCalledWith(
              expect.objectContaining({
                text: expect.stringContaining('ORDER BY is_default_list DESC, l.created_at $5'),
                values: expect.arrayContaining([sortDirection])
              })
            )

            expect(dbQueryMock).toBeCalledWith(
              expect.objectContaining({
                text: expect.stringContaining('LIMIT $6 OFFSET $7'),
                values: expect.arrayContaining([10, 0])
              })
            )
          })
        })
      })

      describe('and the sort by is "name"', () => {
        describe.each([ListSortDirection.ASC, ListSortDirection.DESC])('and the sort direction is "%s"', sortDirection => {
          it('should have made the query to get the lists matching those conditions', async () => {
            await expect(
              listsComponent.getLists({
                offset: 0,
                limit: 10,
                userAddress: '0xuseraddress',
                sortBy: ListSortBy.NAME,
                sortDirection
              })
            ).resolves.toEqual(dbGetLists)

            expect(dbQueryMock).toBeCalledWith(
              expect.objectContaining({
                text: expect.stringContaining('ORDER BY is_default_list DESC, l.name $5'),
                values: expect.arrayContaining([sortDirection])
              })
            )

            expect(dbQueryMock).toBeCalledWith(
              expect.objectContaining({
                text: expect.stringContaining('LIMIT $6 OFFSET $7'),
                values: expect.arrayContaining([10, 0])
              })
            )
          })
        })
      })
    })
  })
})

describe('when creating a new list', () => {
  let name: string

  beforeEach(() => {
    name = 'Test List'
  })

  describe('and there is already a list created with the same name', () => {
    beforeEach(() => {
      // Insert List Mock Query
      dbClientQueryMock.mockRejectedValueOnce({
        constraint: 'name_user_address_unique'
      })
    })

    it('should throw a duplicated list name error', async () => {
      await expect(listsComponent.addList({ name, userAddress, private: false })).rejects.toEqual(new DuplicatedListError(name))
    })
  })

  describe('and the insert query fails with an unexpected error', () => {
    beforeEach(() => {
      // Insert List Mock Query
      dbClientQueryMock.mockRejectedValueOnce(new Error("Unexpected error when inserting the list's data"))
    })

    it('should throw a generic error', async () => {
      await expect(listsComponent.addList({ name, userAddress, private: false })).rejects.toEqual(new Error("The list couldn't be created"))
    })
  })

  describe('and the access query fails with an unexpected error', () => {
    beforeEach(() => {
      // Insert List Mock Query
      dbClientQueryMock.mockResolvedValueOnce({ rows: [{ id: listId }] })

      // Access Mock Query
      dbClientQueryMock.mockRejectedValueOnce(new Error("Unexpected error when inserting the list's data"))
    })

    it('should throw a generic error', async () => {
      await expect(listsComponent.addList({ name, userAddress, private: false })).rejects.toEqual(new Error("The list couldn't be created"))
    })
  })

  describe('and there are no lists with the same name', () => {
    let dbList: DBList
    let result: DBList

    beforeEach(() => {
      dbList = {
        id: listId,
        name,
        user_address: userAddress,
        description: null,
        created_at: new Date()
      }

      // Create List Query
      dbClientQueryMock.mockResolvedValueOnce({
        rowCount: 1,
        rows: [dbList]
      })
    })

    describe('and the list should be private', () => {
      beforeEach(async () => {
        // Access Mock Query
        dbClientQueryMock.mockResolvedValueOnce({ rowCount: 1 })

        result = await listsComponent.addList({ name, userAddress, private: true })
      })

      it('should create the list', () => {
        expect(dbClientQueryMock).toHaveBeenCalledWith(
          expect.objectContaining({
            strings: expect.arrayContaining([expect.stringContaining('INSERT INTO favorites.lists (name, description, user_address)')]),
            values: [name, null, userAddress]
          })
        )
      })

      it('should not delete any access becasue it is a new list without previous rows in the db', () => {
        expect(dbClientQueryMock).not.toHaveBeenCalledWith(
          expect.objectContaining({
            strings: expect.arrayContaining([
              expect.stringContaining('DELETE FROM favorites.acl USING favorites.lists'),
              expect.stringContaining('WHERE favorites.acl.list_id = favorites.lists.id'),
              expect.stringContaining('AND favorites.acl.list_id ='),
              expect.stringContaining('AND favorites.lists.user_address ='),
              expect.stringContaining('AND favorites.acl.permission ='),
              expect.stringContaining('AND favorites.acl.grantee =')
            ]),
            values: [listId, userAddress, Permission.VIEW, '*']
          })
        )
      })

      it('should resolve with the new list', () => {
        expect(result).toEqual(dbList)
      })
    })

    describe('and the list should be public', () => {
      beforeEach(async () => {
        // Access Mock Query
        dbClientQueryMock.mockResolvedValueOnce(undefined)

        result = await listsComponent.addList({ name, userAddress, private: false })
      })

      it('should create the list', () => {
        expect(dbClientQueryMock).toHaveBeenCalledWith(
          expect.objectContaining({
            strings: expect.arrayContaining([expect.stringContaining('INSERT INTO favorites.lists (name, description, user_address)')]),
            values: [name, null, userAddress]
          })
        )
      })

      it('should insert a new access to make the list public', () => {
        expect(dbClientQueryMock).toHaveBeenCalledWith(
          expect.objectContaining({
            strings: expect.arrayContaining([expect.stringContaining('INSERT INTO favorites.acl (list_id, permission, grantee) VALUES')]),
            values: [listId, Permission.VIEW, '*']
          })
        )
      })

      it('should resolve with the new list', () => {
        expect(result).toEqual(dbList)
      })
    })
  })
})

describe('when deleting a list', () => {
  describe('and the list was not found or was not accessible by the user', () => {
    let error: Error

    beforeEach(() => {
      error = new ListNotFoundError(listId)
      dbQueryMock.mockResolvedValueOnce({ rowCount: 0 })
    })

    it('should throw a list not found error', () => {
      return expect(listsComponent.deleteList(listId, userAddress)).rejects.toEqual(error)
    })
  })

  describe('and the list was successfully deleted', () => {
    let result: void

    beforeEach(async () => {
      dbQueryMock.mockResolvedValueOnce({ rowCount: 1 })
      result = await listsComponent.deleteList(listId, userAddress)
    })

    it('should have made the query to delete the list', () => {
      expect(dbQueryMock).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('DELETE FROM favorites.lists')
        })
      )

      expect(dbQueryMock).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('WHERE favorites.lists.id = $1'),
          values: expect.arrayContaining([listId])
        })
      )

      expect(dbQueryMock).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('AND favorites.lists.user_address = $2'),
          values: expect.arrayContaining([userAddress])
        })
      )
    })

    it('should resolve', () => {
      return expect(result).toEqual(undefined)
    })
  })
})

describe('when getting a list', () => {
  describe('and the list was not found or was not accessible by the user', () => {
    let error: Error

    beforeEach(() => {
      error = new ListNotFoundError(listId)
      dbQueryMock.mockResolvedValueOnce({ rowCount: 0 })
    })

    it('should throw a list not found error', () => {
      return expect(listsComponent.getList(listId, { userAddress })).rejects.toEqual(error)
    })
  })

  describe('and neither the default list nor the permissions should be considered', () => {
    let dbList: DBList
    let result: DBList

    beforeEach(async () => {
      dbList = {
        id: 'aListId',
        name: 'aListName',
        description: null,
        user_address: 'aUserAddress',
        created_at: new Date()
      }

      dbQueryMock.mockResolvedValueOnce({ rowCount: 1, rows: [dbList] })
      result = await listsComponent.getList(listId, { userAddress, considerDefaultList: false })
    })

    it('should have made the query to get without checking if the list belongs to the default user or if has the required permissions', () => {
      expect(dbQueryMock).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining(
            'SELECT favorites.lists.*, favorites.acl.permission AS permission, COUNT(favorites.picks.item_id) AS count_items'
          )
        })
      )

      expect(dbQueryMock).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('FROM favorites.lists')
        })
      )

      expect(dbQueryMock).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining(
            'LEFT JOIN favorites.picks ON favorites.lists.id = favorites.picks.list_id AND favorites.picks.user_address = $1'
          ),
          values: expect.arrayContaining([userAddress])
        })
      )

      expect(dbQueryMock).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('LEFT JOIN favorites.acl ON favorites.lists.id = favorites.acl.list_id')
        })
      )

      expect(dbQueryMock).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('WHERE favorites.lists.id = $2 AND (favorites.lists.user_address = $3)'),
          values: expect.arrayContaining([listId, userAddress])
        })
      )

      expect(dbQueryMock).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('GROUP BY favorites.lists.id, favorites.acl.permission')
        })
      )

      expect(dbQueryMock).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('ORDER BY favorites.acl.permission ASC LIMIT 1')
        })
      )
    })

    it('should resolve with the list', () => {
      return expect(result).toEqual(dbList)
    })
  })

  describe('and the default list should be considered but not the permissions', () => {
    let dbList: DBList
    let result: DBList

    beforeEach(async () => {
      dbList = {
        id: 'aListId',
        name: 'aListName',
        description: null,
        user_address: 'aUserAddress',
        created_at: new Date()
      }

      dbQueryMock.mockResolvedValueOnce({ rowCount: 1, rows: [dbList] })
      result = await listsComponent.getList(listId, { userAddress, considerDefaultList: true })
    })

    it('should have made the query to get the list checking if the list belongs to the default user without taking into account the permissions', () => {
      expect(dbQueryMock).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining(
            'SELECT favorites.lists.*, favorites.acl.permission AS permission, COUNT(favorites.picks.item_id) AS count_items'
          )
        })
      )

      expect(dbQueryMock).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('FROM favorites.lists')
        })
      )

      expect(dbQueryMock).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining(
            'LEFT JOIN favorites.picks ON favorites.lists.id = favorites.picks.list_id AND favorites.picks.user_address = $1'
          ),
          values: expect.arrayContaining([userAddress])
        })
      )

      expect(dbQueryMock).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('LEFT JOIN favorites.acl ON favorites.lists.id = favorites.acl.list_id')
        })
      )

      expect(dbQueryMock).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining(
            'WHERE favorites.lists.id = $2 AND (favorites.lists.user_address = $3 OR favorites.lists.user_address = $4)'
          ),
          values: expect.arrayContaining([listId, userAddress, DEFAULT_LIST_USER_ADDRESS])
        })
      )

      expect(dbQueryMock).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('GROUP BY favorites.lists.id, favorites.acl.permission')
        })
      )

      expect(dbQueryMock).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('ORDER BY favorites.acl.permission ASC LIMIT 1')
        })
      )
    })

    it('should resolve with the list', () => {
      return expect(result).toEqual(dbList)
    })
  })

  describe('and both the default list and the permissions should be considered', () => {
    let dbList: DBList
    let result: DBList

    beforeEach(() => {
      dbList = {
        id: 'aListId',
        name: 'aListName',
        description: null,
        user_address: 'aUserAddress',
        created_at: new Date()
      }
    })

    describe('and the required permission is EDIT', () => {
      let permission: Permission

      beforeEach(async () => {
        permission = Permission.EDIT

        dbList = {
          ...dbList,
          permission
        }

        dbQueryMock.mockResolvedValueOnce({ rowCount: 1, rows: [dbList] })
        result = await listsComponent.getList(listId, { userAddress, considerDefaultList: true, requiredPermission: permission })
      })

      it('should have made the query to get the list matching the permission conditions', () => {
        expect(dbQueryMock).toHaveBeenCalledWith(
          expect.objectContaining({
            text: expect.stringContaining(
              'SELECT favorites.lists.*, favorites.acl.permission AS permission, COUNT(favorites.picks.item_id) AS count_items'
            )
          })
        )

        expect(dbQueryMock).toHaveBeenCalledWith(
          expect.objectContaining({
            text: expect.stringContaining('FROM favorites.lists')
          })
        )

        expect(dbQueryMock).toHaveBeenCalledWith(
          expect.objectContaining({
            text: expect.stringContaining(
              'LEFT JOIN favorites.picks ON favorites.lists.id = favorites.picks.list_id AND favorites.picks.user_address = $1'
            ),
            values: expect.arrayContaining([userAddress])
          })
        )

        expect(dbQueryMock).toHaveBeenCalledWith(
          expect.objectContaining({
            text: expect.stringContaining('LEFT JOIN favorites.acl ON favorites.lists.id = favorites.acl.list_id')
          })
        )

        expect(dbQueryMock).toHaveBeenCalledWith(
          expect.objectContaining({
            text: expect.stringContaining(
              'WHERE favorites.lists.id = $2 AND (favorites.lists.user_address = $3 OR favorites.lists.user_address = $4) OR ((favorites.acl.grantee = $5 OR favorites.acl.grantee = $6) AND favorites.acl.permission IN ($7)'
            ),
            values: expect.arrayContaining([listId, userAddress, DEFAULT_LIST_USER_ADDRESS, userAddress, '*', permission])
          })
        )

        expect(dbQueryMock).toHaveBeenCalledWith(
          expect.objectContaining({
            text: expect.stringContaining('GROUP BY favorites.lists.id, favorites.acl.permission')
          })
        )

        expect(dbQueryMock).toHaveBeenCalledWith(
          expect.objectContaining({
            text: expect.stringContaining('ORDER BY favorites.acl.permission ASC LIMIT 1')
          })
        )
      })

      it('should resolve with the list', () => {
        return expect(result).toEqual(dbList)
      })
    })

    describe('and the required permission is VIEW', () => {
      let permission: Permission

      beforeEach(async () => {
        permission = Permission.VIEW

        dbList = {
          ...dbList,
          permission
        }

        dbQueryMock.mockResolvedValueOnce({ rowCount: 1, rows: [dbList] })
        result = await listsComponent.getList(listId, { userAddress, considerDefaultList: true, requiredPermission: permission })
      })

      it('should have made the query to get the list matching the permission conditions', () => {
        expect(dbQueryMock).toHaveBeenCalledWith(
          expect.objectContaining({
            text: expect.stringContaining(
              'SELECT favorites.lists.*, favorites.acl.permission AS permission, COUNT(favorites.picks.item_id) AS count_items'
            )
          })
        )

        expect(dbQueryMock).toHaveBeenCalledWith(
          expect.objectContaining({
            text: expect.stringContaining('FROM favorites.lists')
          })
        )

        expect(dbQueryMock).toHaveBeenCalledWith(
          expect.objectContaining({
            text: expect.stringContaining(
              'LEFT JOIN favorites.picks ON favorites.lists.id = favorites.picks.list_id AND favorites.picks.user_address = $1'
            ),
            values: expect.arrayContaining([userAddress])
          })
        )

        expect(dbQueryMock).toHaveBeenCalledWith(
          expect.objectContaining({
            text: expect.stringContaining('LEFT JOIN favorites.acl ON favorites.lists.id = favorites.acl.list_id')
          })
        )

        expect(dbQueryMock).toHaveBeenCalledWith(
          expect.objectContaining({
            text: expect.stringContaining(
              'WHERE favorites.lists.id = $2 AND (favorites.lists.user_address = $3 OR favorites.lists.user_address = $4) OR ((favorites.acl.grantee = $5 OR favorites.acl.grantee = $6) AND favorites.acl.permission IN ($7))'
            ),
            values: expect.arrayContaining([
              listId,
              userAddress,
              DEFAULT_LIST_USER_ADDRESS,
              userAddress,
              '*',
              `${permission},${Permission.EDIT}`
            ])
          })
        )

        expect(dbQueryMock).toHaveBeenCalledWith(
          expect.objectContaining({
            text: expect.stringContaining('GROUP BY favorites.lists.id, favorites.acl.permission')
          })
        )

        expect(dbQueryMock).toHaveBeenCalledWith(
          expect.objectContaining({
            text: expect.stringContaining('ORDER BY favorites.acl.permission ASC LIMIT 1')
          })
        )
      })

      it('should resolve with the list', () => {
        return expect(result).toEqual(dbList)
      })
    })
  })
})

describe('when updating a list', () => {
  let updatedList: UpdateListRequestBody
  let name: string

  beforeEach(() => {
    name = 'Updated List Name'
    updatedList = {
      name,
      description: 'Updated List Description'
    }

    // Begin Query
    dbClientQueryMock.mockResolvedValueOnce(undefined)
  })

  describe('and the list does not exist', () => {
    beforeEach(() => {
      // Update List Mock Query
      dbClientQueryMock.mockResolvedValueOnce({ rowCount: 0 })

      // Access Mock Query
      dbClientQueryMock.mockResolvedValueOnce(undefined)
    })

    it('should rollback the changes, release the client and throw a list not found error', async () => {
      await expect(listsComponent.updateList(listId, userAddress, updatedList)).rejects.toEqual(new ListNotFoundError(listId))
      expect(dbClientQueryMock).not.toHaveBeenCalledWith('COMMIT')
      expect(dbClientQueryMock).toHaveBeenCalledWith('ROLLBACK')
      expect(dbClientReleaseMock).toHaveBeenCalled()
    })
  })

  describe('and the list name is being duplicated', () => {
    beforeEach(() => {
      // Update List Mock Query
      dbClientQueryMock.mockRejectedValueOnce({ constraint: 'name_user_address_unique' })

      // Access Mock Query
      dbClientQueryMock.mockResolvedValueOnce(undefined)
    })

    it('should rollback the changes, release the client and throw a duplicated list error', async () => {
      await expect(listsComponent.updateList(listId, userAddress, updatedList)).rejects.toEqual(new DuplicatedListError(name))
      expect(dbClientQueryMock).not.toHaveBeenCalledWith('COMMIT')
      expect(dbClientQueryMock).toHaveBeenCalledWith('ROLLBACK')
      expect(dbClientReleaseMock).toHaveBeenCalled()
    })
  })

  describe('and the access is being duplicated', () => {
    beforeEach(() => {
      // Update List Mock Query
      dbClientQueryMock.mockResolvedValueOnce({ rowCount: 1 })

      // Access Mock Query
      dbClientQueryMock.mockRejectedValueOnce({ constraint: 'list_id_permissions_grantee_primary_key' })
    })

    it('should rollback the changes, release the client and throw a duplicated access error', async () => {
      await expect(listsComponent.updateList(listId, userAddress, updatedList)).rejects.toEqual(
        new DuplicatedAccessError(listId, Permission.VIEW, '*')
      )
      expect(dbClientQueryMock).not.toHaveBeenCalledWith('COMMIT')
      expect(dbClientQueryMock).toHaveBeenCalledWith('ROLLBACK')
      expect(dbClientReleaseMock).toHaveBeenCalled()
    })
  })

  describe('and the update or select query fails because of an unexpected error', () => {
    beforeEach(() => {
      // Update List Mock Query
      dbClientQueryMock.mockRejectedValueOnce(new Error('Unexpected Error'))
    })

    it('should rollback the changes, release the client and throw a generic error', async () => {
      await expect(listsComponent.updateList(listId, userAddress, updatedList)).rejects.toEqual(new Error("The list couldn't be updated"))
      expect(dbClientQueryMock).not.toHaveBeenCalledWith('COMMIT')
      expect(dbClientQueryMock).toHaveBeenCalledWith('ROLLBACK')
      expect(dbClientReleaseMock).toHaveBeenCalled()
    })
  })

  describe('and the access query fails because of an unexpected error', () => {
    beforeEach(() => {
      // Update List Mock Query
      dbClientQueryMock.mockResolvedValueOnce({ rowCount: 1 })

      // Access Mock Query
      dbClientQueryMock.mockRejectedValueOnce(new Error('Unexpected Error'))
    })

    it('should rollback the changes, release the client and throw a generic error', async () => {
      await expect(listsComponent.updateList(listId, userAddress, updatedList)).rejects.toEqual(new Error("The list couldn't be updated"))
      expect(dbClientQueryMock).not.toHaveBeenCalledWith('COMMIT')
      expect(dbClientQueryMock).toHaveBeenCalledWith('ROLLBACK')
      expect(dbClientReleaseMock).toHaveBeenCalled()
    })
  })

  describe('and setting the list as private', () => {
    beforeEach(() => {
      updatedList = {
        ...updatedList,
        private: true
      }
    })

    describe('and the lists exists but the access to be removed does not', () => {
      beforeEach(() => {
        // Update List Mock Query
        dbClientQueryMock.mockResolvedValueOnce({ rowCount: 1 })

        // Delete Access Mock Query
        dbClientQueryMock.mockResolvedValueOnce({ rowCount: 0 })
      })

      it('should rollback the changes, release the client and throw a access not found error', async () => {
        await expect(listsComponent.updateList(listId, userAddress, updatedList)).rejects.toEqual(
          new AccessNotFoundError(listId, Permission.VIEW, '*')
        )
        expect(dbClientQueryMock).not.toHaveBeenCalledWith('COMMIT')
        expect(dbClientQueryMock).toHaveBeenCalledWith('ROLLBACK')
        expect(dbClientReleaseMock).toHaveBeenCalled()
      })
    })

    describe('and the list and access exist, and the name is not being duplicated', () => {
      let dbList: DBList
      let result: DBList

      beforeEach(async () => {
        dbList = {
          id: listId,
          name: 'aListName',
          description: null,
          user_address: userAddress,
          created_at: new Date()
        }

        // Update List Mock Query
        dbClientQueryMock.mockResolvedValueOnce({
          rowCount: 1,
          rows: [dbList]
        })

        // Delete Access Mock Query
        dbClientQueryMock.mockResolvedValueOnce({ rowCount: 1 })
      })

      describe('and the updated list has only an updated name without a new description', () => {
        beforeEach(async () => {
          result = await listsComponent.updateList(listId, userAddress, { ...updatedList, description: undefined })
        })

        it('should begin the transaction', () => {
          expect(dbClientQueryMock).toHaveBeenCalledWith('BEGIN')
        })

        it('should update the list', () => {
          expect(dbClientQueryMock).toHaveBeenCalledWith(
            expect.objectContaining({
              strings: expect.arrayContaining([
                expect.stringContaining('UPDATE favorites.lists SET'),
                expect.stringContaining('name ='),
                expect.stringContaining('WHERE id ='),
                expect.stringContaining('AND user_address ='),
                expect.stringContaining('RETURNING *')
              ]),
              values: [updatedList.name, listId, userAddress]
            })
          )
        })

        it('should delete the previous access to make the list private', () => {
          expect(dbClientQueryMock).toHaveBeenCalledWith(
            expect.objectContaining({
              strings: expect.arrayContaining([
                expect.stringContaining('DELETE FROM favorites.acl USING favorites.lists'),
                expect.stringContaining('WHERE favorites.acl.list_id = favorites.lists.id'),
                expect.stringContaining('AND favorites.acl.list_id ='),
                expect.stringContaining('AND favorites.lists.user_address ='),
                expect.stringContaining('AND favorites.acl.permission ='),
                expect.stringContaining('AND favorites.acl.grantee =')
              ]),
              values: [listId, userAddress, Permission.VIEW, '*']
            })
          )
        })

        it('should resolve with the updated list', () => {
          expect(result).toEqual(dbList)
        })

        it('should commit the changes and release the client', () => {
          expect(dbClientQueryMock).toHaveBeenCalledWith('COMMIT')
          expect(dbClientReleaseMock).toHaveBeenCalled()
        })
      })

      describe('and the updated list has only an updated description without a new name', () => {
        beforeEach(async () => {
          result = await listsComponent.updateList(listId, userAddress, { ...updatedList, name: undefined })
        })

        it('should begin the transaction', () => {
          expect(dbClientQueryMock).toHaveBeenCalledWith('BEGIN')
        })

        it('should update the list', () => {
          expect(dbClientQueryMock).toHaveBeenCalledWith(
            expect.objectContaining({
              strings: expect.arrayContaining([
                expect.stringContaining('UPDATE favorites.lists SET'),
                expect.stringContaining('description ='),
                expect.stringContaining('WHERE id ='),
                expect.stringContaining('AND user_address ='),
                expect.stringContaining('RETURNING *')
              ]),
              values: [updatedList.description, listId, userAddress]
            })
          )
        })

        it('should delete the previous access to make the list private', () => {
          expect(dbClientQueryMock).toHaveBeenCalledWith(
            expect.objectContaining({
              strings: expect.arrayContaining([
                expect.stringContaining('DELETE FROM favorites.acl USING favorites.lists'),
                expect.stringContaining('WHERE favorites.acl.list_id = favorites.lists.id'),
                expect.stringContaining('AND favorites.acl.list_id ='),
                expect.stringContaining('AND favorites.lists.user_address ='),
                expect.stringContaining('AND favorites.acl.permission ='),
                expect.stringContaining('AND favorites.acl.grantee =')
              ]),
              values: [listId, userAddress, Permission.VIEW, '*']
            })
          )
        })

        it('should resolve with the updated list', () => {
          expect(result).toEqual(dbList)
        })

        it('should commit the changes and release the client', () => {
          expect(dbClientQueryMock).toHaveBeenCalledWith('COMMIT')
          expect(dbClientReleaseMock).toHaveBeenCalled()
        })
      })

      describe('and the updated list has both an updated name and description', () => {
        beforeEach(async () => {
          result = await listsComponent.updateList(listId, userAddress, updatedList)
        })

        it('should begin the transaction', () => {
          expect(dbClientQueryMock).toHaveBeenCalledWith('BEGIN')
        })

        it('should update the list', () => {
          expect(dbClientQueryMock).toHaveBeenCalledWith(
            expect.objectContaining({
              strings: expect.arrayContaining([
                expect.stringContaining('UPDATE favorites.lists SET'),
                expect.stringContaining('name ='),
                expect.stringContaining(', description ='),
                expect.stringContaining('WHERE id ='),
                expect.stringContaining('AND user_address ='),
                expect.stringContaining('RETURNING *')
              ]),
              values: [updatedList.name, updatedList.description, listId, userAddress]
            })
          )
        })

        it('should delete the previous access to make the list private', () => {
          expect(dbClientQueryMock).toHaveBeenCalledWith(
            expect.objectContaining({
              strings: expect.arrayContaining([
                expect.stringContaining('DELETE FROM favorites.acl USING favorites.lists'),
                expect.stringContaining('WHERE favorites.acl.list_id = favorites.lists.id'),
                expect.stringContaining('AND favorites.acl.list_id ='),
                expect.stringContaining('AND favorites.lists.user_address ='),
                expect.stringContaining('AND favorites.acl.permission ='),
                expect.stringContaining('AND favorites.acl.grantee =')
              ]),
              values: [listId, userAddress, Permission.VIEW, '*']
            })
          )
        })

        it('should resolve with the updated list', () => {
          expect(result).toEqual(dbList)
        })

        it('should commit the changes and release the client', () => {
          expect(dbClientQueryMock).toHaveBeenCalledWith('COMMIT')
          expect(dbClientReleaseMock).toHaveBeenCalled()
        })
      })
    })
  })

  describe('and setting the list as public', () => {
    beforeEach(() => {
      updatedList = {
        ...updatedList,
        private: false
      }
    })

    describe('and the list and access exist, and the name is not being duplicated', () => {
      let dbList: DBList
      let result: DBList

      beforeEach(() => {
        dbList = {
          id: listId,
          name: 'aListName',
          description: null,
          user_address: userAddress,
          created_at: new Date()
        }

        // Update List Mock Query
        dbClientQueryMock.mockResolvedValueOnce({
          rowCount: 1,
          rows: [dbList]
        })

        // Delete Access Mock Query
        dbClientQueryMock.mockResolvedValueOnce({ rowCount: 1 })
      })

      describe('and the updated list has only an updated name without a new description', () => {
        beforeEach(async () => {
          result = await listsComponent.updateList(listId, userAddress, { ...updatedList, description: undefined })
        })

        it('should begin the transaction', () => {
          expect(dbClientQueryMock).toHaveBeenCalledWith('BEGIN')
        })

        it('should update the list', () => {
          expect(dbClientQueryMock).toHaveBeenCalledWith(
            expect.objectContaining({
              strings: expect.arrayContaining([
                expect.stringContaining('UPDATE favorites.lists SET'),
                expect.stringContaining('name ='),
                expect.stringContaining('WHERE id ='),
                expect.stringContaining('AND user_address ='),
                expect.stringContaining('RETURNING *')
              ]),
              values: [updatedList.name, listId, userAddress]
            })
          )
        })

        it('should insert a new access to make the list public', () => {
          expect(dbClientQueryMock).toHaveBeenCalledWith(
            expect.objectContaining({
              strings: expect.arrayContaining([expect.stringContaining('INSERT INTO favorites.acl (list_id, permission, grantee) VALUES')]),
              values: [listId, Permission.VIEW, '*']
            })
          )
        })

        it('should resolve with the updated list', () => {
          expect(result).toEqual(dbList)
        })

        it('should commit the changes and release the client', () => {
          expect(dbClientQueryMock).toHaveBeenCalledWith('COMMIT')
          expect(dbClientReleaseMock).toHaveBeenCalled()
        })
      })

      describe('and the updated list has only an updated description without a new name', () => {
        beforeEach(async () => {
          result = await listsComponent.updateList(listId, userAddress, { ...updatedList, name: undefined })
        })

        it('should begin the transaction', () => {
          expect(dbClientQueryMock).toHaveBeenCalledWith('BEGIN')
        })

        it('should update the list', () => {
          expect(dbClientQueryMock).toHaveBeenCalledWith(
            expect.objectContaining({
              strings: expect.arrayContaining([
                expect.stringContaining('UPDATE favorites.lists SET'),
                expect.stringContaining('description ='),
                expect.stringContaining('WHERE id ='),
                expect.stringContaining('AND user_address ='),
                expect.stringContaining('RETURNING *')
              ]),
              values: [updatedList.description, listId, userAddress]
            })
          )
        })

        it('should insert a new access to make the list public', () => {
          expect(dbClientQueryMock).toHaveBeenCalledWith(
            expect.objectContaining({
              strings: expect.arrayContaining([expect.stringContaining('INSERT INTO favorites.acl (list_id, permission, grantee) VALUES')]),
              values: [listId, Permission.VIEW, '*']
            })
          )
        })

        it('should resolve with the updated list', () => {
          expect(result).toEqual(dbList)
        })

        it('should commit the changes and release the client', () => {
          expect(dbClientQueryMock).toHaveBeenCalledWith('COMMIT')
          expect(dbClientReleaseMock).toHaveBeenCalled()
        })
      })

      describe('and the updated list has both an updated name and description', () => {
        beforeEach(async () => {
          result = await listsComponent.updateList(listId, userAddress, updatedList)
        })

        it('should begin the transaction', () => {
          expect(dbClientQueryMock).toHaveBeenCalledWith('BEGIN')
        })

        it('should update the list', () => {
          expect(dbClientQueryMock).toHaveBeenCalledWith(
            expect.objectContaining({
              strings: expect.arrayContaining([
                expect.stringContaining('UPDATE favorites.lists SET'),
                expect.stringContaining('name ='),
                expect.stringContaining(', description ='),
                expect.stringContaining('WHERE id ='),
                expect.stringContaining('AND user_address ='),
                expect.stringContaining('RETURNING *')
              ]),
              values: [updatedList.name, updatedList.description, listId, userAddress]
            })
          )
        })

        it('should insert a new access to make the list public', () => {
          expect(dbClientQueryMock).toHaveBeenCalledWith(
            expect.objectContaining({
              strings: expect.arrayContaining([expect.stringContaining('INSERT INTO favorites.acl (list_id, permission, grantee) VALUES')]),
              values: [listId, Permission.VIEW, '*']
            })
          )
        })

        it('should resolve with the updated list', () => {
          expect(result).toEqual(dbList)
        })

        it('should commit the changes and release the client', () => {
          expect(dbClientQueryMock).toHaveBeenCalledWith('COMMIT')
          expect(dbClientReleaseMock).toHaveBeenCalled()
        })
      })
    })
  })

  describe('and nothing is being updated besides the access', () => {
    let dbList: DBList
    let result: DBList

    beforeEach(async () => {
      updatedList = {
        ...updatedList,
        name: undefined,
        description: undefined
      }

      dbList = {
        id: listId,
        name: 'aListName',
        description: null,
        user_address: userAddress,
        created_at: new Date()
      }

      // Update List Mock Query
      dbClientQueryMock.mockResolvedValueOnce({
        rowCount: 1,
        rows: [dbList]
      })

      // Delete Access Mock Query
      dbClientQueryMock.mockResolvedValueOnce({ rowCount: 1 })

      result = await listsComponent.updateList(listId, userAddress, updatedList)
    })

    it('should begin the transaction', () => {
      expect(dbClientQueryMock).toHaveBeenCalledWith('BEGIN')
    })

    it('should get the list instead of updating it', () => {
      expect(dbClientQueryMock).toHaveBeenCalledWith(
        expect.objectContaining({
          strings: expect.arrayContaining([
            expect.stringContaining(
              'SELECT favorites.lists.*, favorites.acl.permission AS permission, COUNT(favorites.picks.item_id) AS count_items'
            ),
            expect.stringContaining('FROM favorites.lists'),
            expect.stringContaining(
              'LEFT JOIN favorites.picks ON favorites.lists.id = favorites.picks.list_id AND favorites.picks.user_address ='
            ),
            expect.stringContaining('LEFT JOIN favorites.acl ON favorites.lists.id = favorites.acl.list_id'),
            expect.stringContaining('WHERE favorites.lists.id ='),
            expect.stringContaining('AND (favorites.lists.user_address ='),
            expect.stringContaining('OR favorites.lists.user_address ='),
            expect.stringContaining(')'),
            expect.stringContaining('GROUP BY favorites.lists.id, favorites.acl.permission'),
            expect.stringContaining('ORDER BY favorites.acl.permission ASC LIMIT 1')
          ]),
          values: [userAddress, listId, userAddress, DEFAULT_LIST_USER_ADDRESS]
        })
      )
    })

    it('should resolve with the updated list', () => {
      expect(result).toEqual(dbList)
    })

    it('should commit the changes and release the client', () => {
      expect(dbClientQueryMock).toHaveBeenCalledWith('COMMIT')
      expect(dbClientReleaseMock).toHaveBeenCalled()
    })
  })
})
