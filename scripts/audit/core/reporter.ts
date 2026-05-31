import { writeFileSync } from 'node:fs';
import type { AuditFinding, AuditReport } from './finding';
import { buildSummary, severityIcon } from './severity';

export function buildReport(project: string, findings: AuditFinding[]): AuditReport {
  return {
    project,
    generatedAt: new Date().toISOString(),
    summary: buildSummary(findings),
    findings
  };
}

export function writeJsonReport(report: AuditReport): void {
  writeFileSync('audit-report.json', JSON.stringify(report, null, 2));
}

export function writeMarkdownReport(report: AuditReport): void {
  const lines: string[] = [];

  lines.push(`# ${report.project} - Audit Report`);
  lines.push('');
  lines.push(`Generated at: \`${report.generatedAt}\``);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`- Total: ${report.summary.total}`);
  lines.push(`- 🔴 Critical: ${report.summary.critical}`);
  lines.push(`- 🟡 High: ${report.summary.high}`);
  lines.push(`- 🟢 Medium: ${report.summary.medium}`);
  lines.push(`- 🔵 Low: ${report.summary.low}`);
  lines.push(`- ⚪️ Trace: ${report.summary.trace}`);
  lines.push('');

  if (report.findings.length === 0) {
    lines.push('## Findings');
    lines.push('');
    lines.push('No findings detected.');
    writeFileSync('audit-report.md', lines.join('\n'));
    return;
  }

  const grouped = groupByDomain(report.findings);

  for (const [domain, findings] of Object.entries(grouped)) {
    lines.push(`## ${domain}`);
    lines.push('');

    for (const finding of findings) {
      lines.push(`### ${severityIcon[finding.severity]} ${finding.id}: ${finding.title}`);
      lines.push('');
      lines.push(`**Severity:** \`${finding.severity}\``);
      lines.push('');
      lines.push(`**Description:** ${finding.description}`);
      lines.push('');
      lines.push(`**Recommendation:** ${finding.recommendation}`);
      lines.push('');

      if (finding.file) {
        lines.push(`**File:** \`${finding.file}${finding.line ? `:${finding.line}` : ''}\``);
        lines.push('');
      }

      if (finding.evidence) {
        lines.push('**Evidence:**');
        lines.push('');
        lines.push('```text');
        lines.push(finding.evidence.trim());
        lines.push('```');
        lines.push('');
      }
    }
  }

  writeFileSync('audit-report.md', lines.join('\n'));
}

function groupByDomain(findings: AuditFinding[]): Record<string, AuditFinding[]> {
  return findings.reduce<Record<string, AuditFinding[]>>((acc, finding) => {
    acc[finding.domain] ??= [];
    acc[finding.domain].push(finding);
    return acc;
  }, {});
}
