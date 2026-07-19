import { CURRENT_SCHEMA_VERSION } from '../schema';
import {
  FakeSQLiteDatabase,
  expectedFullObjectCounts,
  locationEvidenceObjectCounts,
} from '../testUtils/fakeSQLiteDatabase';

async function loadModules(fakeDatabase: FakeSQLiteDatabase) {
  jest.resetModules();

  const openDatabaseAsync = jest.fn(async () => fakeDatabase);

  jest.doMock('expo-sqlite', () => ({
    openDatabaseAsync,
  }));

  const dbModule = require('../db') as typeof import('../db');
  const migrationsModule = require('../migrations') as typeof import('../migrations');
  const healthModule = require('../dbHealth') as typeof import('../dbHealth');
  const loggerModule = require('../../utils/logger') as typeof import('../../utils/logger');

  return {
    openDatabaseAsync,
    dbModule,
    migrationsModule,
    healthModule,
    loggerModule,
  };
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe('database bootstrap hardening', () => {
  let consoleLogSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('treats user_version=0 with existing tables as legacy baseline and migrates conservatively', async () => {
    const fakeDatabase = new FakeSQLiteDatabase({
      schema: 'full',
      userVersion: 0,
    });

    const { dbModule } = await loadModules(fakeDatabase);

    await dbModule.initDatabase();
    await flushMicrotasks();

    expect(fakeDatabase.userVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(fakeDatabase.countStatements(/^CREATE TABLE/i)).toBe(0);

    const systemLogs = fakeDatabase.getRows('system_logs');
    expect(systemLogs.some((entry) => entry.mensaje === 'DB_LEGACY_BASELINE_DETECTED')).toBe(true);
  });

  it('applies pending migrations in order and only once', async () => {
    const emptyDatabase = new FakeSQLiteDatabase({ schema: 'none', userVersion: 0 });
    const { migrationsModule: emptyMigrations } = await loadModules(emptyDatabase);

    const emptyResult = await emptyMigrations.runDatabaseMigrations(emptyDatabase);

    expect(emptyResult.appliedVersions).toEqual([1, 2]);
    expect(emptyDatabase.userVersion).toBe(CURRENT_SCHEMA_VERSION);

    const partialDatabase = new FakeSQLiteDatabase({ schema: 'core', userVersion: 1 });
    const { migrationsModule } = await loadModules(partialDatabase);

    const partialResult = await migrationsModule.runDatabaseMigrations(partialDatabase);

    expect(partialResult.appliedVersions).toEqual([2]);
    expect(partialDatabase.userVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(partialDatabase.hasTable(locationEvidenceObjectCounts.tableName)).toBe(true);
  });

  it('keeps bootstrap idempotent across repeated initialization', async () => {
    const fakeDatabase = new FakeSQLiteDatabase({ schema: 'none', userVersion: 0 });
    const { dbModule, openDatabaseAsync } = await loadModules(fakeDatabase);

    const first = await dbModule.initDatabase();
    const second = await dbModule.initDatabase();
    await flushMicrotasks();

    expect(first).toBe(second);
    expect(openDatabaseAsync).toHaveBeenCalledTimes(1);
    expect(fakeDatabase.userVersion).toBe(CURRENT_SCHEMA_VERSION);

    expect(fakeDatabase.countStatements(/^CREATE TABLE/i)).toBe(expectedFullObjectCounts.tables);
    expect(fakeDatabase.countStatements(/^CREATE (UNIQUE )?INDEX/i)).toBe(
      expectedFullObjectCounts.indexes
    );
  });

  it('makes location_evidence available through the migration flow', async () => {
    const fakeDatabase = new FakeSQLiteDatabase({ schema: 'none', userVersion: 0 });
    const { dbModule } = await loadModules(fakeDatabase);

    await dbModule.initDatabase();

    expect(fakeDatabase.hasTable(locationEvidenceObjectCounts.tableName)).toBe(true);
    expect(fakeDatabase.hasIndex('idx_location_evidence_session_time')).toBe(true);
    expect(fakeDatabase.hasIndex('idx_location_evidence_signal_time')).toBe(true);
    expect(fakeDatabase.hasIndex('idx_location_evidence_created_at')).toBe(true);
  });

  it('reports healthy state for the formalized schema', async () => {
    const fakeDatabase = new FakeSQLiteDatabase({
      schema: 'full',
      userVersion: CURRENT_SCHEMA_VERSION,
    });
    const { healthModule } = await loadModules(fakeDatabase);

    const report = await healthModule.verifyDatabaseHealth(fakeDatabase);

    expect(report.isHealthy).toBe(true);
    expect(report.findings).toEqual([]);
  });

  it('detects missing essential indexes in health checks', async () => {
    const fakeDatabase = new FakeSQLiteDatabase({
      schema: 'full',
      userVersion: CURRENT_SCHEMA_VERSION,
      omitIndexes: ['idx_location_evidence_created_at'],
    });
    const { healthModule } = await loadModules(fakeDatabase);

    const report = await healthModule.verifyDatabaseHealth(fakeDatabase);

    expect(report.isHealthy).toBe(false);
    expect(report.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'MISSING_INDEX',
          indexName: 'idx_location_evidence_created_at',
          safeToRepair: true,
        }),
      ])
    );
  });

  it('skips unsafe repairs when a required location_evidence column is ambiguous', async () => {
    const fakeDatabase = new FakeSQLiteDatabase({
      schema: 'full',
      userVersion: CURRENT_SCHEMA_VERSION,
      omitColumns: [{ tableName: 'location_evidence', columnName: 'event_source' }],
    });
    const { healthModule } = await loadModules(fakeDatabase);

    const initialReport = await healthModule.verifyDatabaseHealth(fakeDatabase);
    const repairResult = await healthModule.repairDatabaseHealth(fakeDatabase);
    const finalReport = await healthModule.verifyDatabaseHealth(fakeDatabase);

    expect(initialReport.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'MISSING_COLUMN',
          tableName: 'location_evidence',
          columnName: 'event_source',
          safeToRepair: false,
        }),
      ])
    );

    expect(repairResult.skippedColumns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          tableName: 'location_evidence',
          columnName: 'event_source',
        }),
      ])
    );

    expect(fakeDatabase.getColumns('location_evidence')).not.toContain('event_source');
    expect(finalReport.isHealthy).toBe(false);
  });

  it('keeps audit_logs and system_logs operational after bootstrap', async () => {
    const fakeDatabase = new FakeSQLiteDatabase({ schema: 'none', userVersion: 0 });
    const { dbModule, loggerModule } = await loadModules(fakeDatabase);

    await dbModule.initDatabase();
    await flushMicrotasks();

    const initialAuditLogCount = fakeDatabase.getRows('audit_logs').length;
    const initialSystemLogCount = fakeDatabase.getRows('system_logs').length;

    await dbModule.insertAuditLog(7, 'TEST_ACTION', 'still works');
    loggerModule.logStructured('INFO', 'ESTADO_SISTEMA', 'DB_COMPATIBILITY_LOG', {
      ok: true,
    });
    await flushMicrotasks();

    expect(fakeDatabase.getRows('audit_logs')).toHaveLength(initialAuditLogCount + 1);
    expect(fakeDatabase.getRows('system_logs').length).toBeGreaterThan(initialSystemLogCount);
  });
});
