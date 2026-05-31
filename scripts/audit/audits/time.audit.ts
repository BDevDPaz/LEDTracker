import type { AuditFinding } from '../core/finding';
import { auditConfig } from '../core/config';
import { collectSourceFiles, fileExists, findLineNumber } from '../core/fileScanner';

export async function runTimeAudit(): Promise<AuditFinding[]> {
  const findings: AuditFinding[] = [];

  const requiredFiles = [
    auditConfig.criticalFiles.dayjsSetup,
    auditConfig.criticalFiles.dateUtils,
    auditConfig.criticalFiles.payrollUtils
  ];

  for (const file of requiredFiles) {
    if (!fileExists(file)) {
      findings.push({
        id: 'TIME-001',
        domain: 'time',
        severity: 'critical',
        title: 'Missing critical time file',
        description: `Required time-related file was not found: ${file}`,
        recommendation: 'Create or restore this file so all date/time logic is centralized.',
        file
      });
    }
  }

  const files = collectSourceFiles(auditConfig.sourceRoots);

  for (const file of files) {
    const isAllowedDateFile = auditConfig.allowedDateFiles.some(allowed =>
      file.path.startsWith(allowed)
    );

    const checks = [
      {
        pattern: 'new Date(',
        severity: 'high' as const,
        id: 'TIME-002',
        title: 'Direct Date constructor usage detected',
        recommendation:
          'Route date creation through dayjsSetup/dateUtils unless this is a deliberate adapter boundary.'
      },
      {
        pattern: 'Date.now(',
        severity: 'medium' as const,
        id: 'TIME-003',
        title: 'Direct Date.now usage detected',
        recommendation:
          'Use a centralized time provider or dateUtils helper to avoid non-deterministic tests and timezone leaks.'
      },
      {
        pattern: '.toISOString()',
        severity: 'medium' as const,
        id: 'TIME-004',
        title: 'Direct toISOString usage detected',
        recommendation:
          'Ensure UTC/local conversion is explicit before persisting or displaying dates.'
      }
    ];

    for (const check of checks) {
      if (file.content.includes(check.pattern) && !isAllowedDateFile) {
        findings.push({
          id: check.id,
          domain: 'time',
          severity: check.severity,
          title: check.title,
          description: `Pattern "${check.pattern}" was found outside approved time utilities.`,
          recommendation: check.recommendation,
          file: file.path,
          line: findLineNumber(file.content, check.pattern),
          evidence: check.pattern
        });
      }
    }
  }

  return findings;
}
