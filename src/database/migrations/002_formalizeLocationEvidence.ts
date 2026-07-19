import { logStructured } from '../../utils/logger';
import {
  LOCATION_EVIDENCE_INDEXES,
  LOCATION_EVIDENCE_TABLE,
} from '../schema';
import { reconcileExpectedSchema } from '../schemaControl';
import type { DatabaseMigration } from './types';

export const migration002FormalizeLocationEvidence: DatabaseMigration = {
  version: 2,
  name: 'formalize-location-evidence',
  async apply(database) {
    const result = await reconcileExpectedSchema(database, {
      tables: [LOCATION_EVIDENCE_TABLE],
      indexes: LOCATION_EVIDENCE_INDEXES,
      seedSettings: false,
    });

    for (const skippedColumn of result.skippedColumns) {
      logStructured('WARN', 'ESTADO_SISTEMA', 'DB_UNSAFE_REPAIR_SKIPPED', skippedColumn);
    }

    return result;
  },
};

