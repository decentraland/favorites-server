import { DBGetPickByListId, DBPick } from "../../ports/lists"
import { PickIdsWithCount, TPick } from "./types"

export function fromDBGetPickByListIdToPickIdsWithCount(dBGetPicksByListId: DBGetPickByListId[]): PickIdsWithCount {
  return {
    picks: dBGetPicksByListId.map((pick) => ({
      itemId: pick.item_id,
    })),
    count: dBGetPicksByListId[0].picks_count,
  }
}

export function fromDBPickToPick(dbPick: DBPick): TPick {
  return {
    itemId: dbPick.item_id,
    userAddress: dbPick.user_address,
    listId: dbPick.list_id,
    createdAt: Number(dbPick.created_at),
  }
}
