import {
  fromDBGetListsToListsWithCount,
  fromDBGetPickByListIdToPickIdsWithCount,
  fromDBListToList,
  fromDBPickToPick,
  ListsWithCount,
  PickIdsWithCount
} from '../../src/adapters/lists'
import { DBGetListsWithCount, DBList } from '../../src/ports/lists'
import { DBGetFilteredPicksWithCount, DBPick } from '../../src/ports/picks'

describe('when transforming DB retrieved picks to pick ids with count', () => {
  let dbGetPicksByListId: DBGetFilteredPicksWithCount[]
  let picksWithCount: PickIdsWithCount

  describe('and there are not DB retrieved picks', () => {
    beforeEach(() => {
      dbGetPicksByListId = []
      picksWithCount = {
        picks: [],
        count: 0
      }
    })

    it('should return an empty array of picks and the count property as 0', () => {
      expect(fromDBGetPickByListIdToPickIdsWithCount(dbGetPicksByListId)).toEqual(picksWithCount)
    })
  })

  describe('and there are multiple DB retrieved picks', () => {
    beforeEach(() => {
      const createdAt = new Date()
      dbGetPicksByListId = [
        {
          item_id: '1',
          user_address: '0x45abb534BD927284F84b03d43f33dF0E5C91C21f',
          list_id: 'e96df126-f5bf-4311-94d8-6e261f368bb2',
          created_at: createdAt,
          picks_count: '3'
        },
        {
          item_id: '11',
          user_address: '0x45abb534BD927284F84b03d43f33dF0E5C91C21f',
          list_id: 'e96df126-f5bf-4311-94d8-6e261f368bb2',
          created_at: createdAt,
          picks_count: '3'
        },
        {
          item_id: '111',
          user_address: '0x45abb534BD927284F84b03d43f33dF0E5C91C21f',
          list_id: 'e96df126-f5bf-4311-94d8-6e261f368bb2',
          created_at: createdAt,
          picks_count: '3'
        }
      ]
      picksWithCount = {
        picks: [
          { itemId: '1', createdAt: Number(createdAt) },
          { itemId: '11', createdAt: Number(createdAt) },
          { itemId: '111', createdAt: Number(createdAt) }
        ],
        count: 3
      }
    })

    it('should return the transformed picks with count', () => {
      expect(fromDBGetPickByListIdToPickIdsWithCount(dbGetPicksByListId)).toEqual(picksWithCount)
    })
  })
})

describe('when transforming a DB retrieved pick to a pick', () => {
  let dbPick: DBPick

  beforeEach(() => {
    const createdAt = new Date()
    dbPick = {
      item_id: '1',
      user_address: '0x45abb534BD927284F84b03d43f33dF0E5C91C21f',
      list_id: 'e96df126-f5bf-4311-94d8-6e261f368bb2',
      created_at: createdAt
    }
  })

  it('should return the transformed pick', () => {
    expect(fromDBPickToPick(dbPick)).toEqual({
      itemId: dbPick.item_id,
      userAddress: dbPick.user_address,
      listId: dbPick.list_id,
      createdAt: Number(dbPick.created_at)
    })
  })
})

describe('when transforming DB retrieved lists to lists with count', () => {
  let dbGetLists: DBGetListsWithCount[]
  let listsWithCount: ListsWithCount

  describe('and there are not DB retrieved lists', () => {
    beforeEach(() => {
      dbGetLists = []
      listsWithCount = {
        lists: [],
        count: 0
      }
    })

    it('should return an empty array of lists and the count property as 0', () => {
      expect(fromDBGetListsToListsWithCount(dbGetLists)).toEqual(listsWithCount)
    })
  })

  describe('and there are multiple DB retrieved lists', () => {
    beforeEach(() => {
      dbGetLists = [
        {
          id: 'e96df126-f5bf-4311-94d8-6e261f368bb1',
          name: 'List #1',
          description: 'Super description of list #1',
          user_address: '0x45abb534BD927284F84b03d43f33dF0E5C91C21f',
          lists_count: '3'
        },
        {
          id: 'e96df126-f5bf-4311-94d8-6e261f368bb2',
          name: 'List #2',
          description: 'Super description of list #2',
          user_address: '0x45abb534BD927284F84b03d43f33dF0E5C91C21f',
          lists_count: '3'
        },
        {
          id: 'e96df126-f5bf-4311-94d8-6e261f368bb3',
          name: 'List #3',
          description: 'Super description of list #3',
          user_address: '0x45abb534BD927284F84b03d43f33dF0E5C91C21f',
          lists_count: '3'
        }
      ]
      listsWithCount = {
        lists: [
          { id: 'e96df126-f5bf-4311-94d8-6e261f368bb1', name: 'List #1' },
          { id: 'e96df126-f5bf-4311-94d8-6e261f368bb2', name: 'List #2' },
          { id: 'e96df126-f5bf-4311-94d8-6e261f368bb3', name: 'List #3' }
        ],
        count: 3
      }
    })

    it('should return the transformed picks with count', () => {
      expect(fromDBGetListsToListsWithCount(dbGetLists)).toEqual(listsWithCount)
    })
  })
})

describe('when transforming a DB retrieved list to a list', () => {
  let dbList: DBList

  beforeEach(() => {
    dbList = {
      id: 'e96df126-f5bf-4311-94d8-6e261f368bb2',
      name: 'List #1',
      user_address: '0x45abb534BD927284F84b03d43f33dF0E5C91C21f',
      description: 'This is a list'
    }
  })

  it('should return the transformed list', () => {
    expect(fromDBListToList(dbList)).toEqual({
      id: dbList.id,
      name: dbList.name,
      userAddress: dbList.user_address,
      description: dbList.description
    })
  })
})
