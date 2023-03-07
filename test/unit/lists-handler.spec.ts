import * as authorizationMiddleware from "decentraland-crypto-middleware"
import { getPicksByListIdHandler } from "../../src/controllers/handlers/lists-handlers"
import { DBGetPickByListId, TPick, PickRow, PicksWithCount } from "../../src/ports/lists"
import { AppComponents, HandlerContextWithPath, StatusCode } from "../../src/types"
import { createTestListsComponent } from "../components"

describe("when getting rental listings", () => {
  let url: URL
  let listId: string
  let components: Pick<AppComponents, "lists">
  let verification: authorizationMiddleware.DecentralandSignatureData | undefined
  let getPicksByListIdMock: jest.Mock
  let request: HandlerContextWithPath<"lists", "/v1/lists/:id/picks">["request"]
  let params: HandlerContextWithPath<"lists", "/v1/lists/:id/picks">["params"]

  beforeEach(() => {
    listId = "list-id"
    getPicksByListIdMock = jest.fn()
    components = {
      lists: createTestListsComponent({ getPicksByListId: getPicksByListIdMock }),
    }
    verification = { auth: "0x0", authMetadata: {} }
    request = {
      clone: jest.fn().mockReturnValue({
        json: () => ({ aTestProp: "someValue" }),
      }),
    } as any
    url = new URL(`http://localhost/v1/lists/${listId}/picks`)
    params = { id: listId }
  })

  describe("and the request is not authenticated", () => {
    beforeEach(() => {
      verification = undefined
    })

    it("should return an unauthorized response", async () => {
      return expect(getPicksByListIdHandler({ url, components, verification, request, params })).resolves.toEqual({
        status: StatusCode.UNAUTHORIZED,
        body: {
          ok: false,
          message: "Unauthorized",
          data: undefined,
        },
      })
    })
  })

  describe("and the process to get the listing is successful", () => {
    let dbPicksByListId: DBGetPickByListId[]
    let picks: TPick[]

    beforeEach(() => {
      dbPicksByListId = [
        {
          item_id: "1",
          picks_count: 1,
        },
      ]
      picks = [{ itemId: "1" }]
      getPicksByListIdMock.mockResolvedValueOnce(dbPicksByListId)
    })

    it("should return a response with an ok status code and the listings", () => {
      return expect(getPicksByListIdHandler({ url, components, verification, request, params })).resolves.toEqual({
        status: StatusCode.OK,
        body: {
          ok: true,
          data: {
            results: picks,
            total: 1,
            page: 0,
            pages: 1,
            limit: 100,
          },
        },
      })
    })
  })
})
