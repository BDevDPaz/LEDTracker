export type AuditSeverity = 'critical' | 'high' | 'medium' | 'low' | 'trace';

export type AuditDomain =
  | 'android'
  | 'concurrency'
  | 'database'
  | 'geofencing'
  | 'logger'
  | 'payroll'
  | 'security'
  | 'time'
  | 'ui'
  | 'static'
  | 'dependencies';

export interface AuditFinding {
  id: string;
  domain: AuditDomain;
  severity: AuditSeverity;
  title: string;
  description: string;
  recommendation: string;
  file?: string;
  line?: number;
  evidence?: string;
}

export interface AuditSummary {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  trace: number;
}

export interface AuditReport {
  project: string;
  generatedAt: string;
  summary: AuditSummary;
  findings: AuditFinding[];
}
