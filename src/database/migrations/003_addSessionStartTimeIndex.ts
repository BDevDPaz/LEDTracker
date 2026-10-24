import { logStructured } from '../../utils/logger';
import { SESSION_PERFORMANCE_INDEXES } from '../schema';
import { reconcileExpectedSchema } from '../schemaControl';
import type { DatabaseMigration } from './types';

export const migration003AddSessionStartTimeIndex: DatabaseMigration = {
  version: 3,
  name: 'add-session-start-time-index',
  async apply(database) {
    const result = await reconcileExpectedSchema(database, {
      tables: [],
      indexes: SESSION_PERFORMANCE_INDEXES,
      seedSettings: false,
    });

    for (const skippedColumn of result.skippedColumns) {
      logStructured('WARN', 'ESTADO_SISTEMA', 'DB_UNSAFE_REPAIR_SKIPPED', skippedColumn);
    }

    return result;
  },
};
