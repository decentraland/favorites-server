import { ILoggerComponent } from '@well-known-components/interfaces'
import SQL from 'sql-template-strings'
import { isErrorWithMessage } from '../../logic/errors'

export function insertVPQuery(power: PromiseSettledResult<number>, userAddress: string, options: { logger: ILoggerComponent.ILogger }) {
  const { logger } = options
  const query = SQL`INSERT INTO favorites.voting (user_address, power) `

  // If the snapshot query fails, try to set the VP to 0 without overwriting it if it already exists
  if (power.status === 'rejected') {
    logger.error(`Querying snapshot failed: ${isErrorWithMessage(power.reason) ? power.reason.message : 'Unknown'}`)
    query.append(SQL`VALUES (${userAddress}, ${0}) ON CONFLICT (user_address) DO NOTHING`)
  } else {
    logger.info(`The voting power for ${userAddress} was updated to ${power.value}`)
    query.append(SQL`VALUES (${userAddress}, ${power.value}) ON CONFLICT (user_address) DO UPDATE SET power = ${power.value}`)
  }

  return query
}
