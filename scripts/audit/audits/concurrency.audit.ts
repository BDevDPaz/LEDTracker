import type { AuditFinding } from '../core/finding';
import { auditConfig } from '../core/config';
import { fileExists, readTextFile, findLineNumber } from '../core/fileScanner';

export async function runConcurrencyAudit(): Promise<AuditFinding[]> {
  const findings: AuditFinding[] = [];
  const file = auditConfig.criticalFiles.backgroundTasks;

  if (!fileExists(file)) {
    return [
      {
        id: 'CONC-001',
        domain: 'concurrency',
        severity: 'critical',
        title: 'BackgroundTasks module missing',
        description: `Expected background task file was not found: ${file}`,
        recommendation:
          'Restore BackgroundTasks.ts or update auditConfig. Background execution must be audited.',
        file
      }
    ];
  }

  const content = readTextFile(file);

  const hasTaskManager = content.includes('TaskManager.defineTask');
  const hasMutex =
    content.toLowerCase().includes('mutex') ||
    content.includes('runExclusive') ||
    content.includes('lock');

  if (hasTaskManager && !hasMutex) {
    findings.push({
      id: 'CONC-002',
      domain: 'concurrency',
      severity: 'critical',
      title: 'Background task without obvious mutex protection',
      description:
        'TaskManager.defineTask is present, but no mutex/lock/runExclusive pattern was detected.',
      recommendation:
        'Protect all DB-writing background tasks with a mutex and re-read state after acquiring the lock.',
      file,
      line: findLineNumber(content, 'TaskManager.defineTask')
    });
  }

  if (hasMutex && !content.includes('finally')) {
    findings.push({
      id: 'CONC-003',
      domain: 'concurrency',
      severity: 'high',
      title: 'Mutex pattern without finally block',
      description:
        'A lock/mutex pattern was detected, but no finally block was found to guarantee release.',
      recommendation:
        'Release locks in finally blocks or use a runExclusive abstraction that guarantees unlock.',
      file
    });
  }

  const dangerousCachedStatePatterns = [
    'let currentSession',
    'let openSession',
    'cached',
    'global.'
  ];

  for (const pattern of dangerousCachedStatePatterns) {
    if (content.includes(pattern)) {
      findings.push({
        id: 'CONC-004',
        domain: 'concurrency',
        severity: 'medium',
        title: 'Potential cached state used in background task',
        description:
          `Pattern "${pattern}" may indicate cached state. Cached state can be stale during background execution.`,
        recommendation:
          'Always load fresh session state from SQLite after acquiring the mutex.',
        file,
        line: findLineNumber(content, pattern),
        evidence: pattern
      });
    }
  }

  if (!content.toUpperCase().includes('MUTEX')) {
    findings.push({
      id: 'CONC-005',
      domain: 'concurrency',
      severity: 'medium',
      title: 'No explicit mutex audit event detected',
      description:
        'The background task file does not clearly log MUTEX lock/unlock events.',
      recommendation:
        'Add forensic logs for MUTEX_LOCK, MUTEX_UNLOCK and MUTEX_SKIPPED/REJECTED.',
      file
    });
  }

  return findings;
}
