import { DBGetFilteredPicksWithCount } from "../../ports/picks"
import { PickUserAddressesWithCount } from "./types"

export function fromDBGetPickByItemIdToPickUserAddressesWithCount(
  dBGetPicksByListId: DBGetFilteredPicksWithCount[]
): PickUserAddressesWithCount {
  return {
    picks: dBGetPicksByListId.map((pick) => ({
      userAddress: pick.user_address,
    })),
    count: dBGetPicksByListId[0]?.picks_count ?? 0,
  }
}
