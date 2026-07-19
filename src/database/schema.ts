export type DatabaseBindValue = string | number | null | boolean | Uint8Array;
export type DatabaseBindParams =
  | Record<string, DatabaseBindValue>
  | DatabaseBindValue[];

export interface DatabaseRunResult {
  lastInsertRowId?: number;
  changes?: number;
}

export interface DatabaseAdapter {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, params?: DatabaseBindParams): Promise<DatabaseRunResult>;
  getFirstAsync<T>(sql: string, params?: DatabaseBindParams): Promise<T | null>;
  getAllAsync<T>(sql: string, params?: DatabaseBindParams): Promise<T[]>;
}

export interface ExpectedColumn {
  name: string;
  definition: string;
  safeToAdd: boolean;
}

export interface ExpectedTable {
  name: string;
  createSql: string;
  columns: ExpectedColumn[];
  readProbeSql: string;
}

export interface ExpectedIndex {
  name: string;
  tableName: string;
  createSql: string;
}

function canSafelyAddColumn(definition: string): boolean {
  const normalized = definition.toUpperCase();

  if (normalized.includes('PRIMARY KEY')) {
    return false;
  }

  if (normalized.includes('NOT NULL') && !normalized.includes('DEFAULT')) {
    return false;
  }

  return true;
}

function column(name: string, definition: string): ExpectedColumn {
  return {
    name,
    definition,
    safeToAdd: canSafelyAddColumn(definition),
  };
}

export const CORE_TABLES: ExpectedTable[] = [
  {
    name: 'work_sessions',
    createSql: `CREATE TABLE IF NOT EXISTS work_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      start_time INTEGER NOT NULL,
      actual_start_time INTEGER,
      end_time INTEGER,
      status TEXT NOT NULL,
      latitude REAL,
      longitude REAL,
      target_latitude REAL,
      target_longitude REAL,
      setup_latitude REAL,
      setup_longitude REAL,
      address TEXT,
      client_name TEXT,
      location_confirmed INTEGER DEFAULT 0,
      is_manual_edit INTEGER DEFAULT 0,
      manual_note TEXT,
      lunch_taken INTEGER DEFAULT 0,
      lunch_start INTEGER,
      lunch_end INTEGER,
      date_string TEXT
    )`,
    columns: [
      column('id', 'INTEGER PRIMARY KEY AUTOINCREMENT'),
      column('start_time', 'INTEGER NOT NULL'),
      column('actual_start_time', 'INTEGER'),
      column('end_time', 'INTEGER'),
      column('status', 'TEXT NOT NULL'),
      column('latitude', 'REAL'),
      column('longitude', 'REAL'),
      column('target_latitude', 'REAL'),
      column('target_longitude', 'REAL'),
      column('setup_latitude', 'REAL'),
      column('setup_longitude', 'REAL'),
      column('address', 'TEXT'),
      column('client_name', 'TEXT'),
      column('location_confirmed', 'INTEGER DEFAULT 0'),
      column('is_manual_edit', 'INTEGER DEFAULT 0'),
      column('manual_note', 'TEXT'),
      column('lunch_taken', 'INTEGER DEFAULT 0'),
      column('lunch_start', 'INTEGER'),
      column('lunch_end', 'INTEGER'),
      column('date_string', 'TEXT'),
    ],
    readProbeSql: 'SELECT id FROM work_sessions LIMIT 1',
  },
  {
    name: 'settings',
    createSql: `CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY NOT NULL,
      employee_name TEXT,
      employer_name TEXT,
      company_email TEXT,
      tolerance_radius INTEGER DEFAULT 200,
      hourly_rate REAL DEFAULT 0,
      language TEXT DEFAULT 'es',
      start_time TEXT DEFAULT '08:00',
      overtime_multiplier REAL DEFAULT 1.5
    )`,
    columns: [
      column('id', 'INTEGER PRIMARY KEY NOT NULL'),
      column('employee_name', 'TEXT'),
      column('employer_name', 'TEXT'),
      column('company_email', 'TEXT'),
      column('tolerance_radius', 'INTEGER DEFAULT 200'),
      column('hourly_rate', 'REAL DEFAULT 0'),
      column('language', "TEXT DEFAULT 'es'"),
      column('start_time', "TEXT DEFAULT '08:00'"),
      column('overtime_multiplier', 'REAL DEFAULT 1.5'),
    ],
    readProbeSql: 'SELECT id FROM settings LIMIT 1',
  },
  {
    name: 'audit_logs',
    createSql: `CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER,
      action_type TEXT NOT NULL,
      details TEXT,
      timestamp INTEGER NOT NULL
    )`,
    columns: [
      column('id', 'INTEGER PRIMARY KEY AUTOINCREMENT'),
      column('session_id', 'INTEGER'),
      column('action_type', 'TEXT NOT NULL'),
      column('details', 'TEXT'),
      column('timestamp', 'INTEGER NOT NULL'),
    ],
    readProbeSql: 'SELECT id FROM audit_logs LIMIT 1',
  },
  {
    name: 'system_logs',
    createSql: `CREATE TABLE IF NOT EXISTS system_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp INTEGER NOT NULL,
      timestamp_str TEXT NOT NULL,
      color TEXT,
      categoria TEXT,
      severidad TEXT,
      mensaje TEXT,
      metadata TEXT
    )`,
    columns: [
      column('id', 'INTEGER PRIMARY KEY AUTOINCREMENT'),
      column('timestamp', 'INTEGER NOT NULL'),
      column('timestamp_str', 'TEXT NOT NULL'),
      column('color', 'TEXT'),
      column('categoria', 'TEXT'),
      column('severidad', 'TEXT'),
      column('mensaje', 'TEXT'),
      column('metadata', 'TEXT'),
    ],
    readProbeSql: 'SELECT id FROM system_logs LIMIT 1',
  },
];

export const LOCATION_EVIDENCE_TABLE: ExpectedTable = {
  name: 'location_evidence',
  createSql: `CREATE TABLE IF NOT EXISTS location_evidence (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER,
    timestamp INTEGER NOT NULL,
    latitude REAL,
    longitude REAL,
    accuracy REAL,
    distance_to_target REAL,
    event_source TEXT NOT NULL,
    signal_type TEXT NOT NULL,
    decision TEXT NOT NULL,
    metadata TEXT,
    created_at INTEGER NOT NULL
  )`,
  columns: [
    column('id', 'INTEGER PRIMARY KEY AUTOINCREMENT'),
    column('session_id', 'INTEGER'),
    column('timestamp', 'INTEGER NOT NULL'),
    column('latitude', 'REAL'),
    column('longitude', 'REAL'),
    column('accuracy', 'REAL'),
    column('distance_to_target', 'REAL'),
    column('event_source', 'TEXT NOT NULL'),
    column('signal_type', 'TEXT NOT NULL'),
    column('decision', 'TEXT NOT NULL'),
    column('metadata', 'TEXT'),
    column('created_at', 'INTEGER NOT NULL'),
  ],
  readProbeSql: 'SELECT id FROM location_evidence LIMIT 1',
};

export const EXPECTED_TABLES: ExpectedTable[] = [
  ...CORE_TABLES,
  LOCATION_EVIDENCE_TABLE,
];

export const CORE_INDEXES: ExpectedIndex[] = [
  {
    name: 'idx_sessions_by_date',
    tableName: 'work_sessions',
    createSql:
      'CREATE INDEX IF NOT EXISTS idx_sessions_by_date ON work_sessions(date_string, status)',
  },
  {
    name: 'idx_sessions_active',
    tableName: 'work_sessions',
    createSql:
      'CREATE INDEX IF NOT EXISTS idx_sessions_active ON work_sessions(status) WHERE status IN ("active", "pending_arrival")',
  },
  {
    name: 'idx_active_session',
    tableName: 'work_sessions',
    createSql:
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_active_session ON work_sessions(date_string, status) WHERE status IN ("pending_arrival", "active")',
  },
  {
    name: 'idx_audit_logs_by_session',
    tableName: 'audit_logs',
    createSql:
      'CREATE INDEX IF NOT EXISTS idx_audit_logs_by_session ON audit_logs(session_id, timestamp)',
  },
  {
    name: 'idx_audit_logs_by_timestamp',
    tableName: 'audit_logs',
    createSql:
      'CREATE INDEX IF NOT EXISTS idx_audit_logs_by_timestamp ON audit_logs(timestamp DESC)',
  },
  {
    name: 'idx_system_logs_by_time',
    tableName: 'system_logs',
    createSql:
      'CREATE INDEX IF NOT EXISTS idx_system_logs_by_time ON system_logs(timestamp DESC)',
  },
];

export const LOCATION_EVIDENCE_INDEXES: ExpectedIndex[] = [
  {
    name: 'idx_location_evidence_session_time',
    tableName: 'location_evidence',
    createSql:
      'CREATE INDEX IF NOT EXISTS idx_location_evidence_session_time ON location_evidence(session_id, timestamp DESC)',
  },
  {
    name: 'idx_location_evidence_signal_time',
    tableName: 'location_evidence',
    createSql:
      'CREATE INDEX IF NOT EXISTS idx_location_evidence_signal_time ON location_evidence(signal_type, timestamp DESC)',
  },
  {
    name: 'idx_location_evidence_created_at',
    tableName: 'location_evidence',
    createSql:
      'CREATE INDEX IF NOT EXISTS idx_location_evidence_created_at ON location_evidence(created_at DESC)',
  },
];

export const EXPECTED_INDEXES: ExpectedIndex[] = [
  ...CORE_INDEXES,
  ...LOCATION_EVIDENCE_INDEXES,
];

export const SETTINGS_SEED_SQL = `INSERT OR IGNORE INTO settings (
  id,
  employee_name,
  employer_name,
  company_email,
  language
) VALUES (1, 'BDevDPaz', 'WTracker Testing Library', 'bdpaz_developer@outlook.com, 'es')`;

export const CURRENT_SCHEMA_VERSION = 2;

export const LOCATION_EVIDENCE_REQUIRED_COLUMNS =
  LOCATION_EVIDENCE_TABLE.columns.map((entry) => entry.name);
