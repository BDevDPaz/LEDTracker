import {
  DatabaseAdapter,
  ExpectedColumn,
  ExpectedIndex,
  ExpectedTable,
  SETTINGS_SEED_PARAMS,
  SETTINGS_SEED_SQL,
} from './schema';

const IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

export interface DatabaseObjectRow {
  name: string;
  type: 'table' | 'index';
  tbl_name: string | null;
  sql: string | null;
}

export interface DatabaseColumnInfo {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | null;
  pk: number;
}

export interface DatabaseTableInfo {
  name: string;
  sql: string | null;
  columns: string[];
}

export interface DatabaseIndexInfo {
  name: string;
  tableName: string | null;
  sql: string | null;
}

export interface DatabaseInventory {
  userVersion: number;
  tables: Record<string, DatabaseTableInfo>;
  indexes: Record<string, DatabaseIndexInfo>;
  userTableNames: string[];
  userIndexNames: string[];
}

export interface ReconcileResult {
  createdTables: string[];
  createdIndexes: string[];
  addedColumns: string[];
  skippedColumns: {
    tableName: string;
    columnName: string;
    reason: string;
  }[];
  seededSettings: boolean;
}

export interface ReconcileOptions {
  tables: ExpectedTable[];
  indexes: ExpectedIndex[];
  seedSettings?: boolean;
}

function sanitizeIdentifier(identifier: string): string {
  if (!IDENTIFIER_PATTERN.test(identifier)) {
    throw new Error(`Unsafe SQLite identifier: ${identifier}`);
  }

  return identifier;
}

function quoteIdentifier(identifier: string): string {
  return `"${sanitizeIdentifier(identifier)}"`;
}

function describeUnsafeColumnAdd(definition: string): string {
  const normalized = definition.toUpperCase();

  if (normalized.includes('PRIMARY KEY')) {
    return 'column is part of a primary key definition';
  }

  if (normalized.includes('NOT NULL') && !normalized.includes('DEFAULT')) {
    return 'column is NOT NULL without a default value for existing rows';
  }

  return 'column requires a potentially unsafe backfill or constraint rewrite';
}

export async function getUserVersion(database: DatabaseAdapter): Promise<number> {
  const row = await database.getFirstAsync<{ user_version?: number }>('PRAGMA user_version');
  return Number(row?.user_version ?? 0);
}

export async function setUserVersion(
  database: DatabaseAdapter,
  version: number
): Promise<void> {
  if (!Number.isSafeInteger(version) || version < 0) {
    throw new Error(`Invalid SQLite user_version: ${version}`);
  }

  await database.execAsync(`PRAGMA user_version = ${version}`);
}

export async function inventoryDatabase(
  database: DatabaseAdapter
): Promise<DatabaseInventory> {
  const [userVersion, objects] = await Promise.all([
    getUserVersion(database),
    database.getAllAsync<DatabaseObjectRow>(`
      SELECT name, type, tbl_name, sql
      FROM sqlite_master
      WHERE type IN ('table', 'index')
        AND name NOT LIKE 'sqlite_%'
      ORDER BY type, name
    `),
  ]);

  const tables: Record<string, DatabaseTableInfo> = {};
  const indexes: Record<string, DatabaseIndexInfo> = {};

  for (const objectRow of objects) {
    if (objectRow.type === 'table') {
      const tableName = sanitizeIdentifier(objectRow.name);
      const columns = await database.getAllAsync<DatabaseColumnInfo>(
        `PRAGMA table_info(${quoteIdentifier(tableName)})`
      );

      tables[tableName] = {
        name: tableName,
        sql: objectRow.sql,
        columns: columns.map((entry) => entry.name),
      };
      continue;
    }

    indexes[objectRow.name] = {
      name: objectRow.name,
      tableName: objectRow.tbl_name,
      sql: objectRow.sql,
    };
  }

  return {
    userVersion,
    tables,
    indexes,
    userTableNames: Object.keys(tables).sort(),
    userIndexNames: Object.keys(indexes).sort(),
  };
}

export function hasExistingUserSchema(inventory: DatabaseInventory): boolean {
  return inventory.userTableNames.length > 0 || inventory.userIndexNames.length > 0;
}

function hasColumn(
  inventory: DatabaseInventory,
  tableName: string,
  columnName: string
): boolean {
  return inventory.tables[tableName]?.columns.includes(columnName) ?? false;
}

async function addColumnIfSafe(
  database: DatabaseAdapter,
  tableName: string,
  column: ExpectedColumn,
  result: ReconcileResult
): Promise<boolean> {
  if (!column.safeToAdd) {
    result.skippedColumns.push({
      tableName,
      columnName: column.name,
      reason: describeUnsafeColumnAdd(column.definition),
    });
    return false;
  }

  await database.execAsync(
    `ALTER TABLE ${quoteIdentifier(tableName)} ADD COLUMN ${column.name} ${column.definition}`
  );
  result.addedColumns.push(`${tableName}.${column.name}`);
  return true;
}

export async function reconcileExpectedSchema(
  database: DatabaseAdapter,
  options: ReconcileOptions
): Promise<ReconcileResult> {
  let inventory = await inventoryDatabase(database);

  const result: ReconcileResult = {
    createdTables: [],
    createdIndexes: [],
    addedColumns: [],
    skippedColumns: [],
    seededSettings: false,
  };

  let inventoryDirty = false;

  for (const expectedTable of options.tables) {
    const existingTable = inventory.tables[expectedTable.name];

    if (!existingTable) {
      await database.execAsync(expectedTable.createSql);
      result.createdTables.push(expectedTable.name);
      inventoryDirty = true;
      continue;
    }

    for (const expectedColumn of expectedTable.columns) {
      if (hasColumn(inventory, expectedTable.name, expectedColumn.name)) {
        continue;
      }

      const added = await addColumnIfSafe(
        database,
        expectedTable.name,
        expectedColumn,
        result
      );
      inventoryDirty = inventoryDirty || added;
    }
  }

  if (inventoryDirty) {
    inventory = await inventoryDatabase(database);
  }

  for (const expectedIndex of options.indexes) {
    if (inventory.indexes[expectedIndex.name]) {
      continue;
    }

    await database.execAsync(expectedIndex.createSql);
    result.createdIndexes.push(expectedIndex.name);
  }

  if (options.seedSettings) {
    const seedResult = await database.runAsync(
      SETTINGS_SEED_SQL,
      [...SETTINGS_SEED_PARAMS]
    );
    result.seededSettings = (seedResult.changes ?? 0) > 0;
  }

  return result;
}

