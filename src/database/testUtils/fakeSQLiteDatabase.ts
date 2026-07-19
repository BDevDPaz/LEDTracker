import {
  CORE_INDEXES,
  CORE_TABLES,
  CURRENT_SCHEMA_VERSION,
  EXPECTED_INDEXES,
  EXPECTED_TABLES,
  LOCATION_EVIDENCE_INDEXES,
  LOCATION_EVIDENCE_TABLE,
  SETTINGS_SEED_SQL,
} from '../schema';

type Row = Record<string, unknown>;

interface TableState {
  name: string;
  sql: string;
  columns: string[];
  rows: Row[];
  nextId: number;
}

interface FakeDatabaseOptions {
  schema?: 'none' | 'core' | 'full';
  userVersion?: number;
  omitIndexes?: string[];
  omitTables?: string[];
  omitColumns?: { tableName: string; columnName: string }[];
}

function normalizeSql(sql: string): string {
  return sql.replace(/\s+/g, ' ').trim();
}

function splitStatements(sql: string): string[] {
  return sql
    .split(';')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseColumnDefinitions(sql: string): string[] {
  const match = sql.match(/\(([\s\S]+)\)$/);
  if (!match) {
    return [];
  }

  return match[1]
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => entry.split(/\s+/)[0]);
}

export class FakeSQLiteDatabase {
  userVersion: number;
  journalMode = 'delete';
  synchronous = 'FULL';
  foreignKeys = 'OFF';
  executedStatements: string[] = [];

  private readonly tables = new Map<string, TableState>();
  private readonly indexes = new Map<string, { tableName: string; sql: string }>();
  private inTransaction = false;

  constructor(options: FakeDatabaseOptions = {}) {
    this.userVersion = options.userVersion ?? 0;

    const schema = options.schema ?? 'none';
    if (schema === 'core') {
      this.seedTables(CORE_TABLES);
      this.seedIndexes(CORE_INDEXES, options.omitIndexes);
      this.applyStatement(SETTINGS_SEED_SQL, [], false);
    } else if (schema === 'full') {
      this.seedTables(EXPECTED_TABLES);
      this.seedIndexes(EXPECTED_INDEXES, options.omitIndexes);
      this.applyStatement(SETTINGS_SEED_SQL, [], false);
      this.userVersion = options.userVersion ?? CURRENT_SCHEMA_VERSION;
    }

    for (const tableName of options.omitTables ?? []) {
      this.tables.delete(tableName);
      for (const [indexName, index] of this.indexes.entries()) {
        if (index.tableName === tableName) {
          this.indexes.delete(indexName);
        }
      }
    }

    for (const entry of options.omitColumns ?? []) {
      const table = this.tables.get(entry.tableName);
      if (!table) {
        continue;
      }

      table.columns = table.columns.filter((columnName) => columnName !== entry.columnName);
      table.rows = table.rows.map((row) => {
        const next = { ...row };
        delete next[entry.columnName];
        return next;
      });
    }
  }

  async execAsync(sql: string): Promise<void> {
    for (const statement of splitStatements(sql)) {
      this.applyStatement(statement, []);
    }
  }

  async runAsync(
    sql: string,
    params: unknown[] = []
  ): Promise<{ lastInsertRowId?: number; changes?: number }> {
    return this.applyStatement(sql, params);
  }

  async getFirstAsync<T>(sql: string, _params: unknown[] = []): Promise<T | null> {
    const normalized = normalizeSql(sql);

    if (normalized === 'PRAGMA journal_mode = WAL') {
      this.journalMode = 'wal';
      return { journal_mode: 'wal' } as T;
    }

    if (normalized === 'PRAGMA user_version') {
      return { user_version: this.userVersion } as T;
    }

    const countMatch = normalized.match(/^SELECT COUNT\(\*\) as count FROM ([A-Za-z_][A-Za-z0-9_]*)$/i);
    if (countMatch) {
      const table = this.getTable(countMatch[1]);
      return { count: table.rows.length } as T;
    }

    const settingsMatch = normalized.match(/^SELECT \* FROM settings WHERE id = 1$/i);
    if (settingsMatch) {
      return (this.getTable('settings').rows[0] ?? null) as T | null;
    }

    const simpleProbeMatch = normalized.match(
      /^SELECT ([A-Za-z_*][A-Za-z0-9_*]*) FROM ([A-Za-z_][A-Za-z0-9_]*) LIMIT 1$/i
    );
    if (simpleProbeMatch) {
      const [, selected, tableName] = simpleProbeMatch;
      const row = this.getTable(tableName).rows[0];
      if (!row) return null;
      if (selected === '*') return row as T;
      return { [selected]: row[selected] } as T;
    }

    return null;
  }

  async getAllAsync<T>(sql: string, _params: unknown[] = []): Promise<T[]> {
    const normalized = normalizeSql(sql);

    if (
      normalized.includes('FROM sqlite_master') &&
      normalized.includes("type IN ('table', 'index')")
    ) {
      const objects: T[] = [];

      for (const table of [...this.tables.values()].sort((a, b) => a.name.localeCompare(b.name))) {
        objects.push({
          name: table.name,
          type: 'table',
          tbl_name: table.name,
          sql: table.sql,
        } as T);
      }

      for (const [name, index] of [...this.indexes.entries()].sort((a, b) =>
        a[0].localeCompare(b[0])
      )) {
        objects.push({
          name,
          type: 'index',
          tbl_name: index.tableName,
          sql: index.sql,
        } as T);
      }

      return objects;
    }

    const tableInfoMatch = normalized.match(/^PRAGMA table_info\("([A-Za-z_][A-Za-z0-9_]*)"\)$/i);
    if (tableInfoMatch) {
      const table = this.getTable(tableInfoMatch[1]);
      return table.columns.map((columnName, index) => ({
        cid: index,
        name: columnName,
        type: '',
        notnull: 0,
        dflt_value: null,
        pk: columnName === 'id' ? 1 : 0,
      })) as T[];
    }

    return [];
  }

  hasTable(tableName: string): boolean {
    return this.tables.has(tableName);
  }

  hasIndex(indexName: string): boolean {
    return this.indexes.has(indexName);
  }

  getColumns(tableName: string): string[] {
    return [...this.getTable(tableName).columns];
  }

  getRows(tableName: string): Row[] {
    return [...this.getTable(tableName).rows];
  }

  countStatements(pattern: RegExp): number {
    return this.executedStatements.filter((statement) => pattern.test(statement)).length;
  }

  private seedTables(tables: typeof EXPECTED_TABLES): void {
    for (const table of tables) {
      this.applyStatement(table.createSql, [], false);
    }
  }

  private seedIndexes(
    indexes: typeof EXPECTED_INDEXES,
    omittedIndexNames: string[] = []
  ): void {
    for (const index of indexes) {
      if (omittedIndexNames.includes(index.name)) {
        continue;
      }

      this.applyStatement(index.createSql, [], false);
    }
  }

  private getTable(tableName: string): TableState {
    const table = this.tables.get(tableName);
    if (!table) {
      throw new Error(`Table not found in fake SQLite database: ${tableName}`);
    }
    return table;
  }

  private applyStatement(
    sql: string,
    params: unknown[] = [],
    track = true
  ): { lastInsertRowId?: number; changes?: number } {
    const normalized = normalizeSql(sql);
    if (track) {
      this.executedStatements.push(normalized);
    }

    if (!normalized) {
      return { changes: 0 };
    }

    const userVersionMatch = normalized.match(/^PRAGMA user_version = (\d+)$/i);
    if (userVersionMatch) {
      this.userVersion = Number(userVersionMatch[1]);
      return { changes: 0 };
    }

    const synchronousMatch = normalized.match(/^PRAGMA synchronous = ([A-Z]+)$/i);
    if (synchronousMatch) {
      this.synchronous = synchronousMatch[1];
      return { changes: 0 };
    }

    const foreignKeysMatch = normalized.match(/^PRAGMA foreign_keys = (ON|OFF)$/i);
    if (foreignKeysMatch) {
      this.foreignKeys = foreignKeysMatch[1];
      return { changes: 0 };
    }

    if (/^BEGIN IMMEDIATE TRANSACTION$/i.test(normalized)) {
      this.inTransaction = true;
      return { changes: 0 };
    }

    if (/^(COMMIT|ROLLBACK)$/i.test(normalized)) {
      this.inTransaction = false;
      return { changes: 0 };
    }

    const createTableMatch = normalized.match(
      /^CREATE TABLE IF NOT EXISTS ([A-Za-z_][A-Za-z0-9_]*) \(([\s\S]+)\)$/i
    );
    if (createTableMatch) {
      const [, tableName] = createTableMatch;
      if (!this.tables.has(tableName)) {
        const columns = parseColumnDefinitions(normalized);
        this.tables.set(tableName, {
          name: tableName,
          sql: normalized,
          columns,
          rows: [],
          nextId: 1,
        });
      }
      return { changes: 0 };
    }

    const createIndexMatch = normalized.match(
      /^CREATE (UNIQUE )?INDEX IF NOT EXISTS ([A-Za-z_][A-Za-z0-9_]*) ON ([A-Za-z_][A-Za-z0-9_]*)([\s\S]*)$/i
    );
    if (createIndexMatch) {
      const [, , indexName, tableName] = createIndexMatch;
      if (!this.indexes.has(indexName)) {
        this.indexes.set(indexName, {
          tableName,
          sql: normalized,
        });
      }
      return { changes: 0 };
    }

    const alterTableMatch = normalized.match(
      /^ALTER TABLE "([A-Za-z_][A-Za-z0-9_]*)" ADD COLUMN ([A-Za-z_][A-Za-z0-9_]*)([\s\S]*)$/i
    );
    if (alterTableMatch) {
      const [, tableName, columnName] = alterTableMatch;
      const table = this.getTable(tableName);
      if (!table.columns.includes(columnName)) {
        table.columns.push(columnName);
        table.rows = table.rows.map((row) => ({ ...row, [columnName]: null }));
      }
      return { changes: 0 };
    }

    const insertMatch = normalized.match(
      /^INSERT(?: OR IGNORE| OR REPLACE)? INTO ([A-Za-z_][A-Za-z0-9_]*) \(([^)]+)\) VALUES (.+)$/i
    );
    if (insertMatch) {
      const [, tableName, rawColumns] = insertMatch;
      const table = this.getTable(tableName);
      const columns = rawColumns.split(',').map((entry) => entry.trim());
      const isIgnore = /^INSERT OR IGNORE/i.test(normalized);
      const isReplace = /^INSERT OR REPLACE/i.test(normalized);
      const rowCount =
        params.length > 0 ? Math.max(1, Math.floor(params.length / columns.length)) : 1;

      let changes = 0;
      let lastInsertRowId: number | undefined;

      for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
        const rowValues =
          params.length > 0
            ? params.slice(rowIndex * columns.length, (rowIndex + 1) * columns.length)
            : [];

        const row: Row = {};
        columns.forEach((columnName, columnIndex) => {
          row[columnName] =
            rowValues[columnIndex] ??
            (columnName === 'id' && tableName === 'settings' ? 1 : null);
        });

        if (!('id' in row) && table.columns.includes('id')) {
          row.id = table.nextId;
        }

        if (tableName === 'settings') {
          const existingRowIndex = table.rows.findIndex((entry) => entry.id === 1);
          if (existingRowIndex >= 0) {
            if (isIgnore) {
              continue;
            }

            if (isReplace) {
              table.rows[existingRowIndex] = { ...table.rows[existingRowIndex], ...row, id: 1 };
              changes += 1;
              lastInsertRowId = 1;
              continue;
            }
          }
        }

        table.rows.push(row);
        changes += 1;
        lastInsertRowId = Number(row.id ?? table.nextId);
        if (table.columns.includes('id')) {
          table.nextId = Math.max(table.nextId, Number(row.id ?? 0) + 1);
        }
      }

      return { changes, lastInsertRowId };
    }

    return { changes: 0 };
  }
}

export const expectedFullObjectCounts = {
  tables: EXPECTED_TABLES.length,
  indexes: EXPECTED_INDEXES.length,
};

export const locationEvidenceObjectCounts = {
  tableName: LOCATION_EVIDENCE_TABLE.name,
  indexes: LOCATION_EVIDENCE_INDEXES.length,
};
