import SQL from 'sql-template-strings'
import { AccessNotFoundError, DuplicatedAccessError } from './errors'
import { Permission } from './types'

export const deleteAccessQuery = (listId: string, permission: Permission, grantee: string, listOwner: string) => SQL`
    DELETE FROM favorites.acl USING favorites.lists
    WHERE favorites.acl.list_id = favorites.lists.id
    AND favorites.acl.list_id = ${listId}
    AND favorites.lists.user_address = ${listOwner}
    AND favorites.acl.permission = ${permission}
    AND favorites.acl.grantee = ${grantee}`

export function validateAccessExists(listId: string, permission: Permission, grantee: string, result: { rowCount: number }) {
  if (!result.rowCount) {
    throw new AccessNotFoundError(listId, permission, grantee)
  }
}

export const insertAccessQuery = (listId: string, permission: Permission, grantee: string) =>
  SQL`INSERT INTO favorites.acl (list_id, permission, grantee) VALUES (${listId}, ${permission}, ${grantee})`

export function validateDuplicatedAccess(listId: string, permission: Permission, grantee: string, error: unknown) {
  if (error && typeof error === 'object' && 'constraint' in error && error.constraint === 'list_id_permissions_grantee_primary_key') {
    throw new DuplicatedAccessError(listId, permission, grantee)
  }
}
