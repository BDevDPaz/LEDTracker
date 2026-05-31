import type { AuditFinding } from '../core/finding';
import { auditConfig } from '../core/config';
import { fileExists, readTextFile, findLineNumber } from '../core/fileScanner';

export async function runPayrollAudit(): Promise<AuditFinding[]> {
  const findings: AuditFinding[] = [];
  const file = auditConfig.criticalFiles.payrollUtils;

  if (!fileExists(file)) {
    return [
      {
        id: 'PAY-001',
        domain: 'payroll',
        severity: 'critical',
        title: 'Payroll module missing',
        description: `Expected payroll module not found: ${file}`,
        recommendation:
          'Restore payrollUtils.ts. Payroll calculations are a release-blocking domain.',
        file
      }
    ];
  }

  const content = readTextFile(file);

  const requiredExports = ['calculateSessionDuration', 'calculatePay'];

  for (const exportName of requiredExports) {
    if (!content.includes(exportName)) {
      findings.push({
        id: 'PAY-002',
        domain: 'payroll',
        severity: 'critical',
        title: `Required payroll function missing: ${exportName}`,
        description:
          `The audit could not detect "${exportName}" in payrollUtils.ts.`,
        recommendation:
          'Expose stable payroll functions so tests, reports and audit scripts use a single calculation source.',
        file
      });
    }
  }

  if (!content.includes('Math.max(0')) {
    findings.push({
      id: 'PAY-003',
      domain: 'payroll',
      severity: 'high',
      title: 'Negative duration guard not detected',
      description:
        'calculateSessionDuration should never return negative payable time.',
      recommendation:
        'Clamp invalid or negative durations to 0 and log invalid inputs separately.',
      file
    });
  }

  if (!content.includes('> 8')) {
    findings.push({
      id: 'PAY-004',
      domain: 'payroll',
      severity: 'high',
      title: 'Daily overtime threshold not detected',
      description:
        'The California-style daily overtime rule after 8 hours was not clearly detected.',
      recommendation:
        'Ensure calculatePay applies overtime after 8 daily hours or update the audit if the rule changed.',
      file
    });
  }

  if (!content.includes('1.5')) {
    findings.push({
      id: 'PAY-005',
      domain: 'payroll',
      severity: 'medium',
      title: 'Default overtime multiplier not detected',
      description:
        'The expected default overtime multiplier of 1.5 was not clearly detected.',
      recommendation:
        'Keep the default overtime multiplier explicit and configurable through AppSettings.',
      file
    });
  }

  if (content.includes('totalHours') && !content.toLowerCase().includes('minute')) {
    findings.push({
      id: 'PAY-006',
      domain: 'payroll',
      severity: 'medium',
      title: 'Payroll appears to operate directly on decimal hours',
      description:
        'The payroll calculation uses totalHours. Decimal hours can be valid, but minutes are safer as the internal unit.',
      recommendation:
        'Consider calculating internally in integer minutes, then converting to decimal hours only for presentation.',
      file,
      line: findLineNumber(content, 'totalHours')
    });
  }

  if (!content.includes('lunchStart') || !content.includes('lunchEnd')) {
    findings.push({
      id: 'PAY-007',
      domain: 'payroll',
      severity: 'high',
      title: 'Exact lunch interval handling not detected',
      description:
        'Payroll should subtract exact lunch duration when lunch_start and lunch_end exist.',
      recommendation:
        'Ensure exact lunch intervals override the default 1-hour deduction.',
      file
    });
  }

  return findings;
}
