import { DBPick, DBGetFilteredPicksWithCount } from '../../ports/picks'
import { TPick } from '../picks'
import { PickIdsWithCount } from './types'

export function fromDBGetPickByListIdToPickIdsWithCount(dBGetPicksByListId: DBGetFilteredPicksWithCount[]): PickIdsWithCount {
  return {
    picks: dBGetPicksByListId.map(pick => ({
      itemId: pick.item_id
    })),
    count: Number(dBGetPicksByListId[0]?.picks_count ?? 0)
  }
}

export function fromDBPickToPick(dbPick: DBPick): TPick {
  return {
    itemId: dbPick.item_id,
    userAddress: dbPick.user_address,
    listId: dbPick.list_id,
    createdAt: Number(dbPick.created_at)
  }
}
