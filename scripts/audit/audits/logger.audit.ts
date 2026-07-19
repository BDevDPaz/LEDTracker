import type { AuditFinding } from '../core/finding';
import { auditConfig } from '../core/config';
import { fileExists, readTextFile, findLineNumber } from '../core/fileScanner';

export async function runLoggerAudit(): Promise<AuditFinding[]> {
  const findings: AuditFinding[] = [];
  const loggerFile = auditConfig.criticalFiles.logger;

  if (!fileExists(loggerFile)) {
    return [
      {
        id: 'LOG-001',
        domain: 'logger',
        severity: 'critical',
        title: 'Logger module missing',
        description: `Logger file not found: ${loggerFile}`,
        recommendation:
          'Restore logger.ts. WTracker requires persistent forensic logging for critical operations.',
        file: loggerFile
      }
    ];
  }

  const content = readTextFile(loggerFile);

  const expectedFields = ['session_id', 'action_type', 'details', 'timestamp'];

  for (const field of expectedFields) {
    if (!content.includes(field)) {
      findings.push({
        id: 'LOG-002',
        domain: 'logger',
        severity: 'high',
        title: `AuditLog field not clearly handled: ${field}`,
        description:
          `The logger does not clearly reference "${field}", which is part of the AuditLog interface.`,
        recommendation:
          'Ensure all audit log writes include session_id, action_type, details and timestamp.',
        file: loggerFile
      });
    }
  }

  const expectedEvents = [
    'AUTO_CHECKIN',
    'AUTO_CHECKIN_GPS',
    'AUTO_CHECKOUT',
    'AUTO_CHECKOUT_GPS',
    'AUTO_CHECKOUT_FAILSAFE',
    'MANUAL',
    'MANUAL_CHECKOUT',
    'OVERLAP',
    'MUTEX',
    'LOCATION',
    'PDF',
    'PAYROLL',
    'GEOFENCE_EXIT'
  ];

  for (const event of expectedEvents) {
    if (!content.toUpperCase().includes(event)) {
      findings.push({
        id: 'LOG-003',
        domain: 'logger',
        severity: 'medium',
        title: `Expected audit event family not detected: ${event}`,
        description:
          `The logger does not clearly define or reference the event family "${event}".`,
        recommendation:
          'Consider standardizing action_type constants for all critical forensic operations.',
        file: loggerFile
      });
    }
  }

  const expectedCheckoutActions = [
    'MANUAL_CHECKOUT',
    'AUTO_CHECKOUT_GPS',
    'AUTO_CHECKOUT_FAILSAFE'
  ];

  for (const checkoutAction of expectedCheckoutActions) {
    if (!content.includes(checkoutAction)) {
      findings.push({
        id: 'LOG-005',
        domain: 'logger',
        severity: 'high',
        title: `Checkout semantic action missing: ${checkoutAction}`,
        description:
          `The logger does not clearly define the checkout action "${checkoutAction}".`,
        recommendation:
          'Define MANUAL_CHECKOUT, AUTO_CHECKOUT_GPS and AUTO_CHECKOUT_FAILSAFE as first-class audit actions.',
        file: loggerFile,
        evidence: checkoutAction
      });
    }
  }

  if (!content.includes('CHECKOUT_AUDIT_ACTIONS')) {
    findings.push({
      id: 'LOG-006',
      domain: 'logger',
      severity: 'medium',
      title: 'Central checkout audit action list missing',
      description:
        'The logger does not clearly expose CHECKOUT_AUDIT_ACTIONS.',
      recommendation:
        'Expose a central list/helper for checkout audit actions to avoid fragile substring matching.',
      file: loggerFile,
      evidence: 'CHECKOUT_AUDIT_ACTIONS'
    });
  }

  const helperNames = [
    'isCheckoutAuditAction',
    'isOfficialCheckoutAuditAction',
    'getCheckoutMethodLabel'
  ];

  for (const helperName of helperNames) {
    if (!content.includes(helperName)) {
      findings.push({
        id: 'LOG-007',
        domain: 'logger',
        severity: 'medium',
        title: `Checkout helper missing: ${helperName}`,
        description:
          `The logger does not clearly expose "${helperName}", which helps keep checkout semantics centralized.`,
        recommendation:
          'Centralize checkout detection and labeling helpers in logger.ts or update this audit if the helpers moved.',
        file: loggerFile,
        evidence: helperName
      });
    }
  }

  const expectedRuntimeResilienceEvents = [
    'RUNTIME_RECONCILE_STARTED',
    'RUNTIME_RECONCILE_COMPLETED',
    'RUNTIME_RECONCILE_SKIPPED',
    'RUNTIME_RECONCILE_FAILED',
    'PENDING_ARRIVAL_RECONCILED_TO_ACTIVE',
    'ACTIVE_SESSION_EXIT_RECONCILED',
    'MONITORING_RESTARTED',
    'MONITORING_ALREADY_ACTIVE',
    'EXIT_TIMESTAMP_STORED',
    'EXIT_TIMESTAMP_ALREADY_PRESENT',
    'GPS_SAMPLE_ACCEPTED_FOR_RECONCILIATION',
    'GPS_SAMPLE_REJECTED_WEAK_ACCURACY'
  ];

  for (const event of expectedRuntimeResilienceEvents) {
    if (!content.includes(event)) {
      findings.push({
        id: 'LOG-008',
        domain: 'logger',
        severity: 'high',
        title: `Runtime resilience event missing: ${event}`,
        description:
          `The logger does not clearly define the runtime resilience event "${event}".`,
        recommendation:
          'Keep Fase D runtime reconciliation events centralized in AUDIT_ACTIONS so runtime behavior remains auditable.',
        file: loggerFile,
        line: findLineNumber(content, 'Runtime Resilience Phase D actions'),
        evidence: event
      });
    }
  }

  const expectedBackgroundMaintenanceEvents = [
    'BACKGROUND_RUN_STARTED',
    'BACKGROUND_RUN_COMPLETED',
    'BACKGROUND_RUN_FAILED',
    'BACKGROUND_FAILSAFE_CHECK_STARTED',
    'BACKGROUND_FAILSAFE_SKIPPED_NO_EXIT_TIMESTAMP',
    'BACKGROUND_FAILSAFE_SKIPPED_THRESHOLD_NOT_MET',
    'BACKGROUND_FAILSAFE_COMPLETED',
    'BACKGROUND_REPORT_CHECK_COMPLETED',
    'BACKGROUND_PENDING_REPORT_RETRY_COMPLETED'
  ];

  for (const event of expectedBackgroundMaintenanceEvents) {
    if (!content.includes(event)) {
      findings.push({
        id: 'LOG-009',
        domain: 'logger',
        severity: 'medium',
        title: `Background maintenance event missing: ${event}`,
        description:
          `The logger does not clearly define the background maintenance event "${event}".`,
        recommendation:
          'Keep background maintenance and failsafe observability events centralized in AUDIT_ACTIONS.',
        file: loggerFile,
        line: findLineNumber(content, 'Background'),
        evidence: event
      });
    }
  }

  const explicitCheckoutActionDeclarations = [
    {
      action: 'MANUAL_CHECKOUT',
      expectedDeclaration: "MANUAL_CHECKOUT: 'MANUAL_CHECKOUT'"
    },
    {
      action: 'AUTO_CHECKOUT_GPS',
      expectedDeclaration: "AUTO_CHECKOUT_GPS: 'AUTO_CHECKOUT_GPS'"
    },
    {
      action: 'AUTO_CHECKOUT_FAILSAFE',
      expectedDeclaration: "AUTO_CHECKOUT_FAILSAFE: 'AUTO_CHECKOUT_FAILSAFE'"
    }
  ];

  for (const { action, expectedDeclaration } of explicitCheckoutActionDeclarations) {
    if (!content.includes(expectedDeclaration)) {
      findings.push({
        id: 'LOG-010',
        domain: 'logger',
        severity: 'high',
        title: `Checkout action is not explicitly self-mapped: ${action}`,
        description:
          `The logger should define "${action}" as a distinct first-class AUDIT_ACTIONS entry.`,
        recommendation:
          `Add or restore the explicit AUDIT_ACTIONS declaration: ${expectedDeclaration}.`,
        file: loggerFile,
        evidence: expectedDeclaration
      });
    }
  }

  const riskyCheckoutAliasPatterns = [
    'AUTO_CHECKOUT_FAILSAFE: AUDIT_ACTIONS.AUTO_CHECKOUT_GPS',
    'AUTO_CHECKOUT_GPS: AUDIT_ACTIONS.AUTO_CHECKOUT_FAILSAFE',
    "AUTO_CHECKOUT_FAILSAFE: 'AUTO_CHECKOUT_GPS'",
    "AUTO_CHECKOUT_GPS: 'AUTO_CHECKOUT_FAILSAFE'"
  ];

  for (const pattern of riskyCheckoutAliasPatterns) {
    if (content.includes(pattern)) {
      findings.push({
        id: 'LOG-011',
        domain: 'logger',
        severity: 'critical',
        title: 'Checkout semantic aliasing detected',
        description:
          'AUTO_CHECKOUT_FAILSAFE and AUTO_CHECKOUT_GPS must remain separate audit semantics.',
        recommendation:
          'Keep AUTO_CHECKOUT_FAILSAFE and AUTO_CHECKOUT_GPS as distinct AUDIT_ACTIONS entries and checkout labels.',
        file: loggerFile,
        line: findLineNumber(content, pattern),
        evidence: pattern
      });
    }
  }

  const riskyPatterns = ['console.log(', 'console.warn(', 'console.error('];

  for (const pattern of riskyPatterns) {
    if (content.includes(pattern)) {
      findings.push({
        id: 'LOG-004',
        domain: 'logger',
        severity: 'low',
        title: 'Console logging detected inside forensic logger',
        description:
          `Pattern "${pattern}" was found in logger.ts.`,
        recommendation:
          'Use console output only as a secondary diagnostic channel; persistent SQLite logs should remain authoritative.',
        file: loggerFile,
        evidence: pattern
      });
    }
  }

  return findings;
}

