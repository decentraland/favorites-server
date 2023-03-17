import { IDatabase } from "@well-known-components/interfaces"
import { IPgComponent } from "@well-known-components/pg-component"
import { createPicksComponent, IPicksComponent, PickStats } from "../../src/ports/picks"
import { createTestPgComponent } from "../components"

let options: {
  userAddress?: string
  power?: number
}
let itemId: string
let dbQueryMock: jest.Mock
let pg: IPgComponent & IDatabase
let picksComponent: IPicksComponent

beforeEach(() => {
  dbQueryMock = jest.fn()
  pg = createTestPgComponent({
    query: dbQueryMock,
  })
  itemId = "0x08de0de733cc11081d43569b809c00e6ddf314fb-0"
  options = {
    userAddress: "0x1dec5f50cb1467f505bb3ddfd408805114406b10",
    power: 2,
  }
  picksComponent = createPicksComponent({ pg })
})

describe("when getting the pick stats of an item", () => {
  let result: PickStats | undefined
  beforeEach(() => {
    result = undefined
  })

  describe("and the power parameter is set", () => {
    beforeEach(async () => {
      options.power = 20
      dbQueryMock.mockResolvedValueOnce({ rows: [{ counts: 1000 }] })
      result = await picksComponent.getPickStats(itemId, options)
    })

    it("should query the favorites that were done by users with power greater and equal than the given power", () => {
      expect(dbQueryMock).toBeCalledWith(
        expect.objectContaining({
          text: expect.stringContaining(`voting.power >= `),
          values: expect.arrayContaining([options.power]),
        })
      )
    })

    it("should return the amount of favorites", () => {
      expect(result).toEqual({ counts: 1000 })
    })
  })

  describe("and the power parameter is not set", () => {
    beforeEach(async () => {
      options.power = undefined
      dbQueryMock.mockResolvedValueOnce({ rows: [{ counts: 1000 }] })
      result = await picksComponent.getPickStats(itemId, options)
    })

    it("should query the favorites that were done by users with power greater and equal than default power", () => {
      expect(dbQueryMock).toBeCalledWith(
        expect.objectContaining({
          text: expect.stringContaining(`voting.power >= `),
          values: expect.arrayContaining([1]),
        })
      )
    })

    it("should return the amount of favorites", () => {
      expect(result).toEqual({ counts: 1000 })
    })
  })

  describe("and the user address parameter is set", () => {
    beforeEach(async () => {
      options.userAddress = "aUserAddress"
      dbQueryMock.mockResolvedValueOnce({ rows: [{ counts: 1000, likedByUser: true }] })
      result = await picksComponent.getPickStats(itemId, options)
    })

    it("should check in the query if the user has liked the item", () => {
      expect(dbQueryMock).toBeCalledWith(
        expect.objectContaining({
          text: expect.stringContaining(", (hasLiked.counter > 0) likedByUser"),
        })
      )
      expect(dbQueryMock).toBeCalledWith(
        expect.objectContaining({
          text: expect.stringContaining("SELECT COUNT(*) counter FROM favorites.picks"),
          values: expect.arrayContaining([options.userAddress, itemId]),
        })
      )
      expect(dbQueryMock).toBeCalledWith(
        expect.objectContaining({
          text: expect.stringContaining("GROUP BY (hasLiked.counter)"),
        })
      )
    })

    it("should return the amount of favorites and the liked by user property", () => {
      expect(result).toEqual({ counts: 1000, likedByUser: true })
    })
  })

  describe("and the user address parameter is not set", () => {
    beforeEach(async () => {
      options.userAddress = undefined
      dbQueryMock.mockResolvedValueOnce({ rows: [{ counts: 1000 }] })
      result = await picksComponent.getPickStats(itemId, options)
    })

    it("should not check in the query if the user has liked the item", () => {
      expect(dbQueryMock).not.toBeCalledWith(
        expect.objectContaining({
          text: expect.stringContaining(", (hasLiked.counter > 0) likedByUser"),
        })
      )
      expect(dbQueryMock).not.toBeCalledWith(
        expect.objectContaining({
          text: expect.stringContaining("SELECT COUNT(*) counter FROM favorites.picks"),
        })
      )
      expect(dbQueryMock).not.toBeCalledWith(
        expect.objectContaining({
          text: expect.stringContaining("GROUP BY (hasLiked.counter)"),
        })
      )
    })

    it("should return the amount of favorites", () => {
      expect(result).toEqual({ counts: 1000 })
    })
  })
})
