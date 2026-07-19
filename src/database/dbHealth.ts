import { logStructured } from '../utils/logger';
import {
  CURRENT_SCHEMA_VERSION,
  EXPECTED_INDEXES,
  EXPECTED_TABLES,
  LOCATION_EVIDENCE_REQUIRED_COLUMNS,
  type DatabaseAdapter,
} from './schema';
import {
  inventoryDatabase,
  reconcileExpectedSchema,
  type DatabaseInventory,
  type ReconcileResult,
} from './schemaControl';

export interface DatabaseHealthFinding {
  code:
    | 'USER_VERSION_BEHIND'
    | 'MISSING_TABLE'
    | 'MISSING_INDEX'
    | 'MISSING_COLUMN'
    | 'READ_PROBE_FAILED'
    | 'WRITE_PROBE_FAILED';
  message: string;
  tableName?: string;
  indexName?: string;
  columnName?: string;
  repairable: boolean;
  safeToRepair: boolean;
}

export interface DatabaseHealthReport {
  isHealthy: boolean;
  userVersion: number;
  findings: DatabaseHealthFinding[];
  inventory: DatabaseInventory;
}

async function runReadProbe(
  database: DatabaseAdapter,
  tableName: string,
  query: string,
  findings: DatabaseHealthFinding[]
): Promise<void> {
  try {
    await database.getFirstAsync(query);
  } catch (error) {
    findings.push({
      code: 'READ_PROBE_FAILED',
      message: `Basic read probe failed for ${tableName}`,
      tableName,
      repairable: false,
      safeToRepair: false,
    });

    logStructured('WARN', 'ESTADO_SISTEMA', 'DB_SCHEMA_INCONSISTENCY_DETECTED', {
      tableName,
      query,
      error,
    });
  }
}

async function runWriteProbe(
  database: DatabaseAdapter,
  findings: DatabaseHealthFinding[]
): Promise<void> {
  try {
    await database.execAsync('BEGIN IMMEDIATE TRANSACTION');
    await database.execAsync('ROLLBACK');
  } catch (error) {
    findings.push({
      code: 'WRITE_PROBE_FAILED',
      message: 'Database did not accept a non-destructive write lock probe',
      repairable: false,
      safeToRepair: false,
    });

    logStructured('WARN', 'ESTADO_SISTEMA', 'DB_SCHEMA_INCONSISTENCY_DETECTED', {
      check: 'write-probe',
      error,
    });
  }
}

export async function verifyDatabaseHealth(
  database: DatabaseAdapter
): Promise<DatabaseHealthReport> {
  logStructured('INFO', 'ESTADO_SISTEMA', 'DB_HEALTH_CHECK_STARTED', {
    expectedSchemaVersion: CURRENT_SCHEMA_VERSION,
  });

  try {
    const inventory = await inventoryDatabase(database);
    const findings: DatabaseHealthFinding[] = [];

    if (inventory.userVersion < CURRENT_SCHEMA_VERSION) {
      findings.push({
        code: 'USER_VERSION_BEHIND',
        message: `Schema version ${inventory.userVersion} is behind expected version ${CURRENT_SCHEMA_VERSION}`,
        repairable: false,
        safeToRepair: false,
      });
    }

    for (const table of EXPECTED_TABLES) {
      const tableInfo = inventory.tables[table.name];

      if (!tableInfo) {
        findings.push({
          code: 'MISSING_TABLE',
          message: `Missing essential table ${table.name}`,
          tableName: table.name,
          repairable: true,
          safeToRepair: true,
        });
        logStructured('WARN', 'ESTADO_SISTEMA', 'DB_SCHEMA_INCONSISTENCY_DETECTED', {
          type: 'table',
          name: table.name,
        });
        continue;
      }

      if (table.name === 'location_evidence') {
        for (const columnName of LOCATION_EVIDENCE_REQUIRED_COLUMNS) {
          if (tableInfo.columns.includes(columnName)) {
            continue;
          }

          const expectedColumn = table.columns.find((entry) => entry.name === columnName);
          findings.push({
            code: 'MISSING_COLUMN',
            message: `Missing required column ${table.name}.${columnName}`,
            tableName: table.name,
            columnName,
            repairable: Boolean(expectedColumn),
            safeToRepair: expectedColumn?.safeToAdd ?? false,
          });
          logStructured('WARN', 'ESTADO_SISTEMA', 'DB_SCHEMA_INCONSISTENCY_DETECTED', {
            type: 'column',
            tableName: table.name,
            columnName,
          });
        }
      }

      await runReadProbe(database, table.name, table.readProbeSql, findings);
    }

    for (const index of EXPECTED_INDEXES) {
      if (inventory.indexes[index.name]) {
        continue;
      }

      findings.push({
        code: 'MISSING_INDEX',
        message: `Missing essential index ${index.name}`,
        tableName: index.tableName,
        indexName: index.name,
        repairable: true,
        safeToRepair: true,
      });
      logStructured('WARN', 'ESTADO_SISTEMA', 'DB_SCHEMA_INCONSISTENCY_DETECTED', {
        type: 'index',
        name: index.name,
        tableName: index.tableName,
      });
    }

    await runWriteProbe(database, findings);

    const report = {
      isHealthy: findings.length === 0,
      userVersion: inventory.userVersion,
      findings,
      inventory,
    };

    logStructured('INFO', 'ESTADO_SISTEMA', 'DB_HEALTH_CHECK_COMPLETED', {
      isHealthy: report.isHealthy,
      findings: report.findings,
      userVersion: report.userVersion,
    });

    return report;
  } catch (error) {
    logStructured('ERROR', 'ESTADO_SISTEMA', 'DB_HEALTH_CHECK_FAILED', { error });
    throw error;
  }
}

export async function repairDatabaseHealth(
  database: DatabaseAdapter
): Promise<ReconcileResult> {
  const result = await reconcileExpectedSchema(database, {
    tables: EXPECTED_TABLES,
    indexes: EXPECTED_INDEXES,
    seedSettings: true,
  });

  for (const skippedColumn of result.skippedColumns) {
    logStructured('WARN', 'ESTADO_SISTEMA', 'DB_UNSAFE_REPAIR_SKIPPED', skippedColumn);
  }

  return result;
}
