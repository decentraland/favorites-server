import { DBGetPickByListId, PicksWithCount } from "../../ports/lists"

export function fromDBGetPickByListIdPickToPicksWithCount(DBGetPicksByListId: DBGetPickByListId[]): PicksWithCount {
  return {
    picks: DBGetPicksByListId.map((pick) => ({
      itemId: pick.item_id,
    })),
    count: DBGetPicksByListId[0].picks_count,
  }
}
