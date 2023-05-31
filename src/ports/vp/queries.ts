import SQL from 'sql-template-strings'

export function insertVPQuery(power: number | undefined, userAddress: string) {
  const query = SQL`INSERT INTO favorites.voting (user_address, power) `

  // If the snapshot query fails, the power will be undefined
  // Try to set the VP to 0 without overwriting it if it already exists
  if (!power) {
    query.append(SQL`VALUES (${userAddress}, ${0}) ON CONFLICT (user_address) DO NOTHING`)
  } else {
    query.append(SQL`VALUES (${userAddress}, ${power}) ON CONFLICT (user_address) DO UPDATE SET power = ${power}`)
  }

  return query
}
