import SQL from 'sql-template-strings'
import { AppComponents } from '../../types'
import { AccessNotFoundError } from './errors'
import { IAccessComponent, Permission } from './types'

export function createAccessComponent(components: Pick<AppComponents, 'pg' | 'logs'>): IAccessComponent {
  const { pg, logs } = components

  const logger = logs.getLogger('Access component')

  async function deleteAccess(listId: string, permission: Permission, grantee: string, listOwner: string): Promise<void> {
    const result = await pg.query<void>(SQL`
    DELETE FROM favorites.ACL USING favorites.lists
    WHERE favorites.ACL.list_id = favorites.lists.id
    AND favorites.ACL.list_id = ${listId}
    AND favorites.lists.user_address = ${listOwner}
    AND favorites.ACL.permission = ${permission}
    AND favorites.ACL.grantee = ${grantee}`)

    if (!result.rowCount) {
      throw new AccessNotFoundError(listId, permission, grantee)
    }

    logger.info(`Deleted access ${permission} for ${grantee} of the list ${listId}`)
  }

  return {
    deleteAccess
  }
}
