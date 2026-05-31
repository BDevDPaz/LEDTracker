import { auditConfig } from './core/config';
import { buildReport, writeJsonReport, writeMarkdownReport } from './core/reporter';
import { shouldFailAudit } from './core/severity';

import { runAndroidAudit } from './audits/android.audit';
import { runConcurrencyAudit } from './audits/concurrency.audit';
import { runDatabaseAudit } from './audits/database.audit';
import { runGeofencingAudit } from './audits/geofencing.audit';
import { runLoggerAudit } from './audits/logger.audit';
import { runPayrollAudit } from './audits/payroll.audit';
import { runSecurityAudit } from './audits/security.audit';
import { runTimeAudit } from './audits/time.audit';
import { runUiAudit } from './audits/ui.audit';

async function main() {
  const findings = [
    ...(await runAndroidAudit()),
    ...(await runTimeAudit()),
    ...(await runDatabaseAudit()),
    ...(await runLoggerAudit()),
    ...(await runConcurrencyAudit()),
    ...(await runGeofencingAudit()),
    ...(await runPayrollAudit()),
    ...(await runUiAudit()),
    ...(await runSecurityAudit())
  ];

  const report = buildReport(auditConfig.projectName, findings);

  writeJsonReport(report);
  writeMarkdownReport(report);

  console.log('');
  console.log(`🛡️ ${report.project}`);
  console.log('Gold Master audit completed.');
  console.log('');
  console.log(`Total: ${report.summary.total}`);
  console.log(`🔴 Critical: ${report.summary.critical}`);
  console.log(`🟡 High: ${report.summary.high}`);
  console.log(`🟢 Medium: ${report.summary.medium}`);
  console.log(`🔵 Low: ${report.summary.low}`);
  console.log(`⚪️ Trace: ${report.summary.trace}`);
  console.log('');
  console.log('Reports generated:');
  console.log('- audit-report.json');
  console.log('- audit-report.md');
  console.log('');

  if (shouldFailAudit(findings)) {
    console.error('❌ Gold Master audit failed due to critical/high findings.');
    process.exit(1);
  }

  console.log('✅ Gold Master audit passed.');
}

main().catch(error => {
  console.error('Unexpected audit failure:', error);
  process.exit(1);
});
