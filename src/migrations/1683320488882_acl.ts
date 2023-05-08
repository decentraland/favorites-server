/* eslint-disable @typescript-eslint/naming-convention */
import { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate'
import { LISTS_TABLE } from './1677778846950_lists-and-picks'

export const shorthands: ColumnDefinitions | undefined = undefined
const ACL_TABLE = 'ACL'
const PERMISSION_TYPE = 'permission'

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createType(PERMISSION_TYPE, ['edit', 'view'])
  pgm.createTable(ACL_TABLE, {
    list_id: {
      type: 'uuid',
      notNull: true,
      unique: false,
      references: `${LISTS_TABLE}(id)`,
      onDelete: 'CASCADE'
    },
    permission: { type: 'permission', notNull: true },
    grantee: { type: 'text', notNull: true }
  })
  pgm.addConstraint(ACL_TABLE, 'list_id_permission_grantee_primary_key', {
    primaryKey: ['list_id', 'permission', 'grantee']
  })
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable(ACL_TABLE)
  pgm.dropType(PERMISSION_TYPE)
}
