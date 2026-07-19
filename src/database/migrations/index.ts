import { logStructured } from '../../utils/logger';
import { CURRENT_SCHEMA_VERSION, type DatabaseAdapter } from '../schema';
import {
  getUserVersion,
  hasExistingUserSchema,
  inventoryDatabase,
  setUserVersion,
} from '../schemaControl';
import { migration001FormalizeCoreSchema } from './001_formalizeCoreSchema';
import { migration002FormalizeLocationEvidence } from './002_formalizeLocationEvidence';
import type { DatabaseMigration } from './types';

const migrations: DatabaseMigration[] = [
  migration001FormalizeCoreSchema,
  migration002FormalizeLocationEvidence,
];

export interface MigrationRunResult {
  initialVersion: number;
  finalVersion: number;
  legacyBaselineDetected: boolean;
  appliedVersions: number[];
}

export async function runDatabaseMigrations(
  database: DatabaseAdapter
): Promise<MigrationRunResult> {
  let inventory = await inventoryDatabase(database);
  const initialVersion = inventory.userVersion;
  const appliedVersions: number[] = [];
  const legacyBaselineDetected =
    initialVersion === 0 && hasExistingUserSchema(inventory);

  if (legacyBaselineDetected) {
    logStructured('INFO', 'ESTADO_SISTEMA', 'DB_LEGACY_BASELINE_DETECTED', {
      userVersion: initialVersion,
      tables: inventory.userTableNames,
      indexes: inventory.userIndexNames,
    });
  }

  for (const migration of migrations) {
    if (migration.version <= initialVersion) {
      continue;
    }

    logStructured('INFO', 'ESTADO_SISTEMA', 'DB_MIGRATION_STARTED', {
      version: migration.version,
      name: migration.name,
    });

    try {
      const result = await migration.apply(database);
      await setUserVersion(database, migration.version);
      appliedVersions.push(migration.version);
      inventory = await inventoryDatabase(database);

      logStructured('INFO', 'ESTADO_SISTEMA', 'DB_MIGRATION_COMPLETED', {
        version: migration.version,
        name: migration.name,
        finalUserVersion: inventory.userVersion,
        createdTables: result.createdTables,
        createdIndexes: result.createdIndexes,
        addedColumns: result.addedColumns,
        skippedColumns: result.skippedColumns,
        seededSettings: result.seededSettings,
      });
    } catch (error) {
      logStructured('ERROR', 'ESTADO_SISTEMA', 'DB_MIGRATION_FAILED', {
        version: migration.version,
        name: migration.name,
        error,
      });
      throw error;
    }
  }

  const finalVersion = await getUserVersion(database);

  return {
    initialVersion,
    finalVersion,
    legacyBaselineDetected,
    appliedVersions,
  };
}

export { CURRENT_SCHEMA_VERSION };
