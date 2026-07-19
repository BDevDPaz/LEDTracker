import { logStructured } from '../../utils/logger';
import { CORE_INDEXES, CORE_TABLES } from '../schema';
import { reconcileExpectedSchema } from '../schemaControl';
import type { DatabaseMigration } from './types';

export const migration001FormalizeCoreSchema: DatabaseMigration = {
  version: 1,
  name: 'formalize-core-schema',
  async apply(database) {
    const result = await reconcileExpectedSchema(database, {
      tables: CORE_TABLES,
      indexes: CORE_INDEXES,
      seedSettings: true,
    });

    for (const skippedColumn of result.skippedColumns) {
      logStructured('WARN', 'ESTADO_SISTEMA', 'DB_UNSAFE_REPAIR_SKIPPED', skippedColumn);
    }

    return result;
  },
};

