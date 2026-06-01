import { writeFileSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import type { AuditFinding, AuditReport } from './finding';
import { buildSummary, severityIcon } from './severity';

// 📁 Carpeta de salida centralizada
const REPORT_DIR = join(process.cwd(), 'scripts/audit/reports');

// 🕒 Timestamp seguro para filenames
function getTimestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

// 🧹 Cleanup: mantener solo los archivos más recientes
function cleanupOldReports(dir: string, maxFiles = 10): void {
  const files = readdirSync(dir)
    .filter(name => name.startsWith('audit-')) // solo históricos
    .map(name => ({
      name,
      path: join(dir, name),
      time: statSync(join(dir, name)).mtime.getTime()
    }))
    .sort((a, b) => b.time - a.time);

  const oldFiles = files.slice(maxFiles);

  for (const file of oldFiles) {
    unlinkSync(file.path);
  }
}

// 📊 Construcción del reporte
export function buildReport(project: string, findings: AuditFinding[]): AuditReport {
  return {
    project,
    generatedAt: new Date().toISOString(),
    summary: buildSummary(findings),
    findings
  };
}

// 🧾 JSON report
export function writeJsonReport(report: AuditReport): void {
  mkdirSync(REPORT_DIR, { recursive: true });
  cleanupOldReports(REPORT_DIR);

  const timestamp = getTimestamp();

  // ✅ Histórico
  writeFileSync(
    join(REPORT_DIR, `audit-${timestamp}.json`),
    JSON.stringify(report, null, 2)
  );

  // ✅ Último (para CI/CD)
  writeFileSync(
    join(REPORT_DIR, 'audit-report.json'),
    JSON.stringify(report, null, 2)
  );
}

// 📝 Markdown report
export function writeMarkdownReport(report: AuditReport): void {
  mkdirSync(REPORT_DIR, { recursive: true });
  cleanupOldReports(REPORT_DIR);

  const timestamp = getTimestamp();
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

    const content = lines.join('\n');

    writeFileSync(join(REPORT_DIR, `audit-${timestamp}.md`), content);
    writeFileSync(join(REPORT_DIR, 'audit-report.md'), content);

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

  const content = lines.join('\n');

  // ✅ Histórico
  writeFileSync(join(REPORT_DIR, `audit-${timestamp}.md`), content);

  // ✅ Último
  writeFileSync(join(REPORT_DIR, 'audit-report.md'), content);
}

// 📦 Agrupar findings por dominio
function groupByDomain(findings: AuditFinding[]): Record<string, AuditFinding[]> {
  return findings.reduce<Record<string, AuditFinding[]>>((acc, finding) => {
    acc[finding.domain] ??= [];
    acc[finding.domain].push(finding);
    return acc;
  }, {});
}

