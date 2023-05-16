import { Permission } from '../../ports/access'
import { DBGetListsWithCount, DBList } from '../../ports/lists'
import { DBPick, DBGetFilteredPicksWithCount } from '../../ports/picks'
import { TPick } from '../picks'
import { ListsWithCount, List, PickIdsWithCount } from './types'

export function fromDBGetPickByListIdToPickIdsWithCount(dBGetPicksByListId: DBGetFilteredPicksWithCount[]): PickIdsWithCount {
  return {
    picks: dBGetPicksByListId.map(pick => ({
      itemId: pick.item_id,
      createdAt: Number(pick.created_at)
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

export function fromDBGetListsToListsWithCount(dbLists: DBGetListsWithCount[]): ListsWithCount {
  return {
    lists: dbLists.map(list => ({
      id: list.id,
      name: list.name
    })),
    count: Number(dbLists[0]?.lists_count ?? 0)
  }
}

export function fromDBListToList(dbList: DBList): List {
  return {
    id: dbList.id,
    name: dbList.name,
    description: dbList.description,
    userAddress: dbList.user_address,
    createdAt: dbList.created_at,
    permission: dbList.permission as Permission
  }
}
