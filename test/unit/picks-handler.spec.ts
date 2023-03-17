import * as authorizationMiddleware from "decentraland-crypto-middleware"
import { getPickStatsHandler } from "../../src/controllers/handlers/picks-handlers"
import { PickStats } from "../../src/ports/picks"
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
  itemId = "list-id"
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
