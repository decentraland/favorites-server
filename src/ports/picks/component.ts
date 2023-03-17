import SQL from "sql-template-strings"
import { AppComponents } from "../../types"
import { DEFAULT_VOTING_POWER } from "./constants"
import { IPicksComponent, PickStats } from "./types"

export function createPicksComponent(components: Pick<AppComponents, "pg">): IPicksComponent {
  const { pg } = components

  async function getPickStats(itemId: string, options?: { userAddress?: string; power?: number }): Promise<PickStats> {
    const checkIfUserLikedTheItem = Boolean(options?.userAddress)
    const query = SQL`SELECT COUNT(DISTINCT picks.user_address)`
    if (checkIfUserLikedTheItem) {
      query.append(", (hasLiked.counter > 0) likedByUser")
    }
    query.append("FROM favorites.picks picks, favorites.voting voting")
    if (checkIfUserLikedTheItem) {
      query.append(
        SQL`, (SELECT COUNT(*) counter FROM favorites.picks WHERE favorites.picks.user_address = ${options?.userAddress} AND favorites.picks.item_id = ${itemId} LIMIT 1) hasLiked`
      )
    }
    query.append(
      SQL`WHERE picks.item_id = ${itemId} AND voting.user_address = picks.user_address AND voting.power >= ${
        options?.power ?? DEFAULT_VOTING_POWER
      }`
    )
    if (checkIfUserLikedTheItem) {
      query.append(`GROUP BY (hasLiked.counter)`)
    }

    const result = await pg.query<PickStats>(query)

    return result.rows[0]
  }

  return { getPickStats }
}
