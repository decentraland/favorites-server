import { fromDBGetPickByItemIdToPickUserAddressesWithCount, PickUserAddressesWithCount } from "../../src/adapters/picks"
import { DBGetFilteredPicksWithCount } from "../../src/ports/picks"

describe("when transforming DB retrieved picks to pick ids with count", () => {
  let dbGetPicksByItemId: DBGetFilteredPicksWithCount[]
  let picksWithCount: PickUserAddressesWithCount

  beforeEach(() => {
    const createdAt = new Date()
    dbGetPicksByItemId = [
      {
        item_id: "1",
        user_address: "0x45abb534BD927284F84b03d43f33dF0E5C91C21f",
        list_id: "e96df126-f5bf-4311-94d8-6e261f368bb2",
        created_at: createdAt,
        picks_count: 3,
      },
      {
        item_id: "11",
        user_address: "0x45abb534BD927284F84b03d43f33dF0E5C91C21e",
        list_id: "e96df126-f5bf-4311-94d8-6e261f368bb2",
        created_at: createdAt,
        picks_count: 3,
      },
      {
        item_id: "111",
        user_address: "0x45abb534BD927284F84b03d43f33dF0E5C91C21d",
        list_id: "e96df126-f5bf-4311-94d8-6e261f368bb2",
        created_at: createdAt,
        picks_count: 3,
      },
    ]
    picksWithCount = {
      results: [
        { userAddress: "0x45abb534BD927284F84b03d43f33dF0E5C91C21f" },
        { userAddress: "0x45abb534BD927284F84b03d43f33dF0E5C91C21e" },
        { userAddress: "0x45abb534BD927284F84b03d43f33dF0E5C91C21d" },
      ],
      count: 3,
    }
  })

  it("should return the transformed pick user addresses with count", () => {
    expect(fromDBGetPickByItemIdToPickUserAddressesWithCount(dbGetPicksByItemId)).toEqual(picksWithCount)
  })
})
