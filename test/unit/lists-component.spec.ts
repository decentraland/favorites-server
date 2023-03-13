import { IDatabase } from "@well-known-components/interfaces"
import { IPgComponent } from "@well-known-components/pg-component"
import { ISubgraphComponent } from "@well-known-components/thegraph-component"
import { createListsComponent, DBGetPickByListId, DBPick, IListsComponents } from "../../src/ports/lists"
import {
  ItemNotFoundError,
  ListNotFoundError,
  PickAlreadyExistsError,
  PickNotFoundError,
} from "../../src/ports/lists/errors"
import { createTestPgComponent, createTestSubgraphComponent } from "../components"

let listId: string
let itemId: string
let userAddress: string
let dbQueryMock: jest.Mock
let collectionsSubgraphQueryMock: jest.Mock
let pg: IPgComponent & IDatabase
let listsComponent: IListsComponents
let collectionsSubgraph: ISubgraphComponent

afterEach(() => {
  jest.resetAllMocks()
})

beforeEach(async () => {
  dbQueryMock = jest.fn()
  collectionsSubgraphQueryMock = jest.fn()
  pg = createTestPgComponent({ query: dbQueryMock })
  collectionsSubgraph = createTestSubgraphComponent({ query: collectionsSubgraphQueryMock })
  listsComponent = await createListsComponent({ pg, collectionsSubgraph })
  listId = "99ffdcd4-0647-41e7-a865-996e2071ed62"
  itemId = "0x08de0de733cc11081d43569b809c00e6ddf314fb-0"
  userAddress = "0x1dec5f50cb1467f505bb3ddfd408805114406b10"
})

describe("when getting picks by list id", () => {
  let dbGetPicksByListId: DBGetPickByListId[]

  describe("and the query throws an error", () => {
    const errorMessage = "Something went wrong while querying the database"

    beforeEach(() => {
      dbQueryMock.mockRejectedValueOnce(new Error(errorMessage))
    })

    it("should propagate the error", () => {
      expect(
        listsComponent.getPicksByListId("list-id", {
          offset: 0,
          limit: 10,
          userAddress: "0xuseraddress",
        })
      ).rejects.toThrowError(errorMessage)
    })
  })

  describe("and the list id, limit, offset, and user address are all set", () => {
    beforeEach(() => {
      dbGetPicksByListId = []
      dbQueryMock.mockResolvedValueOnce({ rows: dbGetPicksByListId })
    })

    it("should have made the query to get the picks matching those conditions", async () => {
      await expect(
        listsComponent.getPicksByListId("list-id", {
          offset: 0,
          limit: 10,
          userAddress: "0xuseraddress",
        })
      ).resolves.toEqual(dbGetPicksByListId)
      expect(dbQueryMock.mock.calls[0][0].text).toEqual(
        expect.stringContaining(`WHERE list_id = $1 AND user_address = $2`)
      )
      expect(dbQueryMock.mock.calls[0][0].text).toEqual(expect.stringContaining(`LIMIT $3 OFFSET $4`))
      expect(dbQueryMock.mock.calls[0][0].values).toEqual(["list-id", "0xuseraddress", 10, 0])
    })
  })
})

describe("when creating a new pick", () => {
  describe("and the user isn't allowed to create a new pick on the given list or the list doesn't exist", () => {
    let error: Error

    beforeEach(() => {
      error = new ListNotFoundError(listId)
      dbQueryMock.mockRejectedValueOnce(error)
    })

    it("should throw a list not found error", () => {
      return expect(listsComponent.addPickToList(listId, itemId, userAddress)).rejects.toEqual(error)
    })
  })

  describe("and the item being picked doesn't exist", () => {
    beforeEach(() => {
      dbQueryMock.mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            id: "aListId",
            name: "aListName",
            description: null,
            user_address: "aUserAddress",
          },
        ],
      })
      collectionsSubgraphQueryMock.mockResolvedValueOnce({ items: [] })
    })

    it("should throw an item not found error", () => {
      return expect(listsComponent.addPickToList(listId, itemId, userAddress)).rejects.toEqual(
        new ItemNotFoundError(itemId)
      )
    })
  })

  describe("and the item being picked exists", () => {
    beforeEach(() => {
      collectionsSubgraphQueryMock.mockResolvedValueOnce({ items: [{ id: itemId }] })
    })

    describe("and the user is allowed to create a new pick on the given list and the list exists", () => {
      beforeEach(() => {
        dbQueryMock.mockResolvedValueOnce({
          rowCount: 1,
          rows: [
            {
              id: "aListId",
              name: "aListName",
              description: null,
              user_address: "aUserAddress",
            },
          ],
        })
      })

      describe("and the pick already exists", () => {
        beforeEach(() => {
          dbQueryMock.mockRejectedValueOnce({ constraint: "item_id_user_address_list_id_primary_key" })
        })

        it("should throw a pick already exists error", () => {
          return expect(listsComponent.addPickToList(listId, itemId, userAddress)).rejects.toEqual(
            new PickAlreadyExistsError(listId, itemId)
          )
        })
      })

      describe("and the pick does not exist already", () => {
        let dbPick: DBPick

        beforeEach(() => {
          dbPick = {
            item_id: itemId,
            user_address: userAddress,
            list_id: listId,
            created_at: new Date(),
          }

          dbQueryMock.mockResolvedValueOnce({
            rowCount: 1,
            rows: [dbPick],
          })
        })

        it("should create the pick and return it", () => {
          return expect(listsComponent.addPickToList(listId, itemId, userAddress)).resolves.toEqual(dbPick)
        })
      })
    })
  })
})

describe("when deleting a pick", () => {
  describe("and the pick was not found or was not accessible by the user", () => {
    let error: Error

    beforeEach(() => {
      error = new PickNotFoundError(listId, itemId)
      dbQueryMock.mockResolvedValueOnce({ rowCount: 0 })
    })

    it("should throw a pick not found error", () => {
      return expect(listsComponent.deletePickInList(listId, itemId, userAddress)).rejects.toEqual(error)
    })
  })

  describe("and the pick was successfully deleted", () => {
    beforeEach(() => {
      dbQueryMock.mockResolvedValueOnce({ rowCount: 1 })
    })

    it("should resolve", () => {
      return expect(listsComponent.deletePickInList(listId, itemId, userAddress)).resolves.toEqual(undefined)
    })
  })
})
