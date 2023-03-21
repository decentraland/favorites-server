import * as authorizationMiddleware from "decentraland-crypto-middleware"
import { TPick } from "../../src/adapters/picks"
import { getPicksByItemIdHandler, getPickStatsHandler } from "../../src/controllers/handlers/picks-handlers"
import { DBGetFilteredPicksWithCount, PickStats } from "../../src/ports/picks"
import { AppComponents, HandlerContextWithPath, StatusCode } from "../../src/types"
import { createTestPicksComponent } from "../components"

let url: URL
let userAddress: string
let verification: authorizationMiddleware.DecentralandSignatureData | undefined
let components: Pick<AppComponents, "picks">
let itemId: string
let getPickStatsMock: jest.Mock

beforeEach(() => {
  userAddress = "0x58ae4c4cb2b35632ea98f214a2918b171f1e1247"
  verification = { auth: userAddress, authMetadata: {} }
  itemId = "item-id"
})

beforeEach(() => {
  getPickStatsMock = jest.fn()
  components = {
    picks: createTestPicksComponent({ getPickStats: getPickStatsMock }),
  }
})

describe("when getting the stats of a pick", () => {
  let request: HandlerContextWithPath<"picks", "/v1/picks/:itemId/stats">["request"]
  let params: HandlerContextWithPath<"picks", "/v1/picks/:itemId/stats">["params"]

  beforeEach(() => {
    request = {} as HandlerContextWithPath<"picks", "/v1/picks/:itemId/stats">["request"]
    params = { itemId }
    url = new URL(`http://localhost/v1/picks/${itemId}/stats`)
  })

  describe("and the power parameter is set and it's not a number", () => {
    beforeEach(() => {
      url = new URL(`http://localhost/v1/picks/${itemId}/stats?power=anInvalidValue`)
    })

    it("should return a bad request response", () => {
      return expect(getPickStatsHandler({ params, components, url, request, verification })).resolves.toEqual({
        status: StatusCode.BAD_REQUEST,
        body: {
          ok: false,
          message: `The value of the power parameter is invalid: anInvalidValue`,
        },
      })
    })
  })

  describe("and the power parameter is set as a number", () => {
    beforeEach(() => {
      url = new URL(`http://localhost/v1/picks/${itemId}/stats?power=200`)
    })

    it("should request the stats using the power parameter", async () => {
      await getPickStatsHandler({ params, components, url, request, verification })
      expect(getPickStatsMock).toHaveBeenCalledWith(itemId, expect.objectContaining({ power: 200 }))
    })
  })

  describe("and the power parameter is not set", () => {
    beforeEach(() => {
      url = new URL(`http://localhost/v1/picks/${itemId}/stats`)
    })

    it("should request the stats without the power parameter", async () => {
      await getPickStatsHandler({ params, components, url, request, verification })
      expect(getPickStatsMock).toHaveBeenCalledWith(itemId, expect.objectContaining({ power: undefined }))
    })
  })

  describe("and the request is authenticated with a signature", () => {
    it("should request the stats using the user address of the authenticated user", async () => {
      await getPickStatsHandler({ params, components, url, request, verification })
      expect(getPickStatsMock).toHaveBeenCalledWith(itemId, expect.objectContaining({ userAddress }))
    })
  })

  describe("and the request is not authenticated with a signature", () => {
    it("should request the stats without a user address", async () => {
      await getPickStatsHandler({ params, components, url, request, verification: undefined })
      expect(getPickStatsMock).toHaveBeenCalledWith(itemId, expect.objectContaining({ userAddress: undefined }))
    })
  })

  describe("and getting the pick stats fails", () => {
    let error: Error

    beforeEach(() => {
      error = new Error("anError")
      getPickStatsMock.mockRejectedValueOnce(error)
    })

    it("should propagate the error", () => {
      return expect(getPickStatsHandler({ params, components, url, request, verification })).rejects.toEqual(error)
    })
  })

  describe("and the request is successful", () => {
    let pickStats: PickStats

    beforeEach(() => {
      pickStats = {
        likedByUser: true,
        count: 1000,
      }
      getPickStatsMock.mockResolvedValueOnce(pickStats)
    })

    it("should return an ok response with the stats", () => {
      return expect(getPickStatsHandler({ params, components, url, request, verification })).resolves.toEqual({
        status: StatusCode.OK,
        body: {
          ok: true,
          data: pickStats,
        },
      })
    })
  })
})

describe("when getting the picks for an item", () => {
  let url: URL
  let getPicksByItemIdMock: jest.Mock
  let request: HandlerContextWithPath<"picks", "/v1/picks/:itemId">["request"]
  let params: HandlerContextWithPath<"picks", "/v1/picks/:itemId">["params"]
  let userAddress: string
  let anotherUserAddress: string
  let dbPicksByItemId: DBGetFilteredPicksWithCount[]
  let picks: Pick<TPick, "userAddress">[]

  beforeEach(() => {
    itemId = "item-id"
    getPicksByItemIdMock = jest.fn()
    components = {
      picks: createTestPicksComponent({ getPicksByItemId: getPicksByItemIdMock }),
    }
    request = {} as HandlerContextWithPath<"lists", "/v1/lists/:id/picks">["request"]
    url = new URL(`http://localhost/v1/lists/${itemId}/picks`)
    params = { itemId }
    userAddress = "0x687abb534BD927284F84b03d43f33dF0E5C91D21"
    anotherUserAddress = "0x45abb534BD927284F84b03d43f33dF0E5C91C21f"

    dbPicksByItemId = [
      {
        item_id: "1",
        user_address: userAddress,
        list_id: "e96df126-f5bf-4311-94d8-6e261f368bb2",
        created_at: new Date(),
        picks_count: 2,
      },
      {
        item_id: "1",
        user_address: anotherUserAddress,
        list_id: "f96df126-f5bf-4311-94d8-6e261f368bb4",
        created_at: new Date(),
        picks_count: 2,
      },
    ]
  })

  describe("and the process to get the picks fails", () => {
    let error: Error

    beforeEach(() => {
      error = new Error("anError")
      getPicksByItemIdMock.mockRejectedValueOnce(error)
    })

    it("should propagate the error", () => {
      return expect(getPicksByItemIdHandler({ params, components, url, request })).rejects.toEqual(error)
    })
  })

  describe("and the process to get the picks is successful", () => {
    describe("when not using pagination parameters", () => {
      beforeEach(() => {
        picks = [{ userAddress }, { userAddress: anotherUserAddress }]
        getPicksByItemIdMock.mockResolvedValueOnce(dbPicksByItemId)
      })

      it("should return a response with an ok status code and the picks using the default values of limit and page", () => {
        return expect(getPicksByItemIdHandler({ url, components, request, params })).resolves.toEqual({
          status: StatusCode.OK,
          body: {
            ok: true,
            data: {
              results: picks,
              total: 2,
              page: 0,
              pages: 1,
              limit: 100,
            },
          },
        })
      })
    })

    describe("when using the pagination parameters", () => {
      it("should return an array with the first pick when the limit is 1 and the page is 0", () => {
        url = new URL(`http://localhost/v1/lists/${itemId}/picks?limit=1&page=0`)
        picks = [{ userAddress }]
        getPicksByItemIdMock.mockResolvedValueOnce([dbPicksByItemId[0]])

        return expect(getPicksByItemIdHandler({ url, components, request, params })).resolves.toEqual({
          status: StatusCode.OK,
          body: {
            ok: true,
            data: {
              results: picks,
              total: 2,
              page: 0,
              pages: 2,
              limit: 1,
            },
          },
        })
      })

      it("should return an array with the second pick when the limit is 1 and the page is 1", () => {
        url = new URL(`http://localhost/v1/lists/${itemId}/picks?limit=1&page=1`)
        picks = [{ userAddress: anotherUserAddress }]
        getPicksByItemIdMock.mockResolvedValueOnce([dbPicksByItemId[1]])

        return expect(getPicksByItemIdHandler({ url, components, request, params })).resolves.toEqual({
          status: StatusCode.OK,
          body: {
            ok: true,
            data: {
              results: picks,
              total: 2,
              page: 1,
              pages: 2,
              limit: 1,
            },
          },
        })
      })
    })
  })
})
