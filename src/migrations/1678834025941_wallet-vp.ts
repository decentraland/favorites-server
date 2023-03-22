/* eslint-disable @typescript-eslint/naming-convention */
import { MigrationBuilder } from 'node-pg-migrate'

export const WALLET_VP = 'voting'

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable(WALLET_VP, {
    user_address: { type: 'text', notNull: true, primaryKey: true },
    power: { type: 'integer', notNull: true }
  })
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable(WALLET_VP)
}
