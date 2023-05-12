import SQL from 'sql-template-strings'
import { AppComponents } from '../../types'
import { AccessNotFoundError, DuplicatedAccessError } from './errors'
import { IAccessComponent, Permission } from './types'

export function createAccessComponent(components: Pick<AppComponents, 'pg' | 'logs' | 'lists'>): IAccessComponent {
  const { pg, logs, lists } = components

  const logger = logs.getLogger('Access component')

  async function deleteAccess(listId: string, permission: Permission, grantee: string, listOwner: string): Promise<void> {
    const result = await pg.query<void>(SQL`
    DELETE FROM favorites.acl USING favorites.lists
    WHERE favorites.acl.list_id = favorites.lists.id
    AND favorites.acl.list_id = ${listId}
    AND favorites.lists.user_address = ${listOwner}
    AND favorites.acl.permission = ${permission}
    AND favorites.acl.grantee = ${grantee}`)

    if (!result.rowCount) {
      throw new AccessNotFoundError(listId, permission, grantee)
    }

    logger.info(`Deleted access ${permission} for ${grantee} of the list ${listId}`)
  }

  async function createAccess(listId: string, permission: Permission, grantee: string, listOwner: string): Promise<void> {
    try {
      await lists.getList(listId, listOwner, false)
      await pg.query<void>(SQL`INSERT INTO favorites.acl (list_id, permission, grantee) VALUES (${listId}, ${permission}, ${grantee})`)
    } catch (error) {
      if (error && typeof error === 'object' && 'constraint' in error && error.constraint === 'list_id_permissions_grantee_primary_key') {
        throw new DuplicatedAccessError(listId, permission, grantee)
      }

      throw error
    }
  }

  return {
    createAccess,
    deleteAccess
  }
}
