import type { AuditFinding } from '../core/finding';
import { auditConfig } from '../core/config';
import { fileExists, readTextFile, findLineNumber } from '../core/fileScanner';

export async function runDatabaseAudit(): Promise<AuditFinding[]> {
  const findings: AuditFinding[] = [];
  const dbFile = auditConfig.criticalFiles.db;

  if (!fileExists(dbFile)) {
    return [
      {
        id: 'DB-001',
        domain: 'database',
        severity: 'critical',
        title: 'Database module missing',
        description: `Database file not found: ${dbFile}`,
        recommendation: 'Restore src/database/db.ts or update auditConfig.criticalFiles.db.',
        file: dbFile
      }
    ];
  }

  const content = readTextFile(dbFile);

  if (!content.includes('journal_mode') || !content.toLowerCase().includes('wal')) {
    findings.push({
      id: 'DB-002',
      domain: 'database',
      severity: 'high',
      title: 'WAL mode not clearly enabled',
      description:
        'The database module does not clearly contain PRAGMA journal_mode=WAL or equivalent WAL activation.',
      recommendation:
        'Enable and verify SQLite WAL mode during database initialization, then log the result.',
      file: dbFile,
      line: findLineNumber(content, 'journal_mode')
    });
  }

  const criticalDbFunctions = [
    'checkSessionOverlap',
    'createSession',
    'updateSession',
    'deleteSession',
    'closeSession',
    'getOpenSession'
  ];

  for (const functionName of criticalDbFunctions) {
    if (!content.includes(functionName)) {
      findings.push({
        id: 'DB-003',
        domain: 'database',
        severity: functionName === 'checkSessionOverlap' ? 'critical' : 'medium',
        title: `Expected database function not detected: ${functionName}`,
        description: `The audit could not find "${functionName}" in ${dbFile}.`,
        recommendation:
          'If the function exists under another name, update the audit rules. Otherwise, implement it to protect session integrity.',
        file: dbFile
      });
    }
  }

  const hasTransactions =
    content.includes('withTransactionAsync') ||
    content.includes('transaction') ||
    content.includes('BEGIN') ||
    content.includes('COMMIT');

  if (!hasTransactions) {
    findings.push({
      id: 'DB-004',
      domain: 'database',
      severity: 'high',
      title: 'No explicit transaction pattern detected',
      description:
        'Critical work-session operations should be protected by SQLite transactions.',
      recommendation:
        'Wrap session creation, updates, deletion and audit logging in explicit transactions.',
      file: dbFile
    });
  }

  const writes = ['INSERT', 'UPDATE', 'DELETE'];
  for (const write of writes) {
    if (content.toUpperCase().includes(write) && !content.toLowerCase().includes('audit')) {
      findings.push({
        id: 'DB-005',
        domain: 'database',
        severity: 'medium',
        title: `Database write detected without obvious audit coupling: ${write}`,
        description:
          'A database write operation exists, but the file does not clearly show audit logging nearby.',
        recommendation:
          'Ensure every critical write emits an audit event with session_id, action_type, details and timestamp.',
        file: dbFile,
        line: findLineNumber(content.toUpperCase(), write)
      });
    }
  }

  return findings;
}
