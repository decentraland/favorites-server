import { IDatabase } from "@well-known-components/interfaces"
import { IPgComponent } from "@well-known-components/pg-component"
import { createListsComponent, DBGetPickByListId, IListsComponents } from "../../src/ports/lists"
import { createTestPgComponent } from "../components"

let dbQueryMock: jest.Mock
let pg: IPgComponent & IDatabase
let listsComponent: IListsComponents

afterEach(() => {
  jest.resetAllMocks()
})

describe("when getting picks by list id", () => {
  let dbGetPicksByListId: DBGetPickByListId[]

  beforeEach(async () => {
    dbQueryMock = jest.fn()
    pg = createTestPgComponent({ query: dbQueryMock })
    listsComponent = await createListsComponent({ pg })
  })

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
