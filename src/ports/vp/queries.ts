import SQL from 'sql-template-strings'

export function insertVPQuery(power: number | undefined, userAddress: string) {
  const query = SQL`INSERT INTO favorites.voting (user_address, power) VALUES (${userAddress}, ${power ?? 0}) ON CONFLICT (user_address) `

  // If the snapshot query fails, the power will be undefined
  // Try to set the VP to 0 without overwriting it if it already exists
  query.append(typeof power === 'undefined' ? 'DO NOTHING' : SQL`DO UPDATE SET power = ${power}`)

  return query
}
