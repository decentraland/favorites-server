import SQL from "sql-template-strings"
import { AppComponents } from "../../types"
import { DEFAULT_VOTING_POWER } from "./constants"
import { DBGetFilteredPicksWithCount, GetPicksByItemIdParameters, IPicksComponent, PickStats } from "./types"

export function createPicksComponent(components: Pick<AppComponents, "pg">): IPicksComponent {
  const { pg } = components

  async function getPickStats(itemId: string, options?: { userAddress?: string; power?: number }): Promise<PickStats> {
    const checkIfUserLikedTheItem = Boolean(options?.userAddress)
    const query = SQL`SELECT COUNT(DISTINCT favorites.picks.user_address)`
    if (checkIfUserLikedTheItem) {
      query.append(", (hasLiked.counter > 0) likedByUser")
    }
    query.append(" FROM favorites.picks, favorites.voting")
    if (checkIfUserLikedTheItem) {
      query.append(
        SQL`, (SELECT COUNT(*) counter FROM favorites.picks WHERE favorites.picks.user_address = ${options?.userAddress} AND favorites.picks.item_id = ${itemId} LIMIT 1) hasLiked`
      )
    }
    query.append(
      SQL` WHERE favorites.picks.item_id = ${itemId} AND favorites.voting.user_address = favorites.picks.user_address AND favorites.voting.power >= ${
        options?.power ?? DEFAULT_VOTING_POWER
      }`
    )
    if (checkIfUserLikedTheItem) {
      query.append(`GROUP BY (hasLiked.counter)`)
    }

    const result = await pg.query<PickStats>(query)

    return result.rows[0]
  }

  async function getPicksByItemId(
    itemId: string,
    options: GetPicksByItemIdParameters
  ): Promise<DBGetFilteredPicksWithCount[]> {
    const { limit, offset } = options
    const result = await pg.query<DBGetFilteredPicksWithCount>(SQL`
        SELECT user_address, COUNT(*) OVER() as picks_count
        FROM (SELECT DISTINCT user_address FROM favorites.picks WHERE item_id = ${itemId}) AS temp
        ORDER BY user_address DESC
        LIMIT ${limit} OFFSET ${offset}
    `)
    return result.rows
  }

  return { getPickStats, getPicksByItemId }
}
