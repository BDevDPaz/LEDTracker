import type { AuditFinding, AuditSeverity, AuditSummary } from './finding';

export const severityIcon: Record<AuditSeverity, string> = {
  critical: '🔴',
  high: '🟡',
  medium: '🟢',
  low: '🔵',
  trace: '⚪️'
};

export function buildSummary(findings: AuditFinding[]): AuditSummary {
  return {
    total: findings.length,
    critical: findings.filter(f => f.severity === 'critical').length,
    high: findings.filter(f => f.severity === 'high').length,
    medium: findings.filter(f => f.severity === 'medium').length,
    low: findings.filter(f => f.severity === 'low').length,
    trace: findings.filter(f => f.severity === 'trace').length
  };
}

export function shouldFailAudit(findings: AuditFinding[]): boolean {
  return findings.some(f => f.severity === 'critical' || f.severity === 'high');
}
