import SQL from 'sql-template-strings'
import { AppComponents } from '../../types'
import { DEFAULT_VOTING_POWER } from './constants'
import {
  DBGetFilteredPicksWithCount,
  DBPickStats,
  GetPicksByItemIdParameters,
  IPicksComponent
} from './types'

export function createPicksComponent(
  components: Pick<AppComponents, 'pg'>
): IPicksComponent {
  const { pg } = components

  /**
   * Gets the picks stats of a set of items.
   * @param itemIds - The ids of the items to get the stats likes for.
   * @param options - The userAddress to get check for a favorite from the user and
   * the power to count votes from user with a voting power greater than the provided number.
   * @returns One stats entry for each given item id, including the items who's votes are zero.
   */
  async function getPicksStats(
    itemIds: string[],
    options?: { userAddress?: string; power?: number }
  ): Promise<DBPickStats[]> {
    const checkIfUserLikedTheItem = Boolean(options?.userAddress)

    const query = SQL`SELECT COUNT(DISTINCT favorites.picks.user_address), items_to_find.item_id AS item_id`
    if (checkIfUserLikedTheItem) {
      query.append(
        SQL`, MAX(CASE WHEN favorites.picks.user_address = ${options?.userAddress} THEN 1 ELSE 0 END)::BOOLEAN AS picked_by_user`
      )
    }

    query.append(
      SQL` FROM favorites.picks
      JOIN favorites.voting ON favorites.picks.user_address = favorites.voting.user_address AND favorites.voting.power >=  ${
        options?.power ?? DEFAULT_VOTING_POWER
      }
      RIGHT JOIN (SELECT unnest(${itemIds}::text[]) AS item_id) AS items_to_find ON favorites.picks.item_id = items_to_find.item_id
      GROUP BY (items_to_find.item_id, favorites.picks.item_id)`
    )

    const result = await pg.query<DBPickStats>(query)
    return result.rows
  }

  async function getPicksByItemId(
    itemId: string,
    options: GetPicksByItemIdParameters
  ): Promise<DBGetFilteredPicksWithCount[]> {
    const { limit, offset } = options
    const result = await pg.query<DBGetFilteredPicksWithCount>(SQL`
        SELECT user_address, COUNT(*) OVER() as picks_count
        FROM (
          SELECT DISTINCT favorites.picks.user_address FROM favorites.picks, favorites.voting
          WHERE favorites.picks.item_id = ${itemId}
          AND favorites.voting.user_address = favorites.picks.user_address AND favorites.voting.power >= ${
            options.power ?? DEFAULT_VOTING_POWER
          }
        ) AS temp
        ORDER BY user_address
        LIMIT ${limit} OFFSET ${offset}
    `)
    return result.rows
  }

  return { getPicksStats, getPicksByItemId }
}
