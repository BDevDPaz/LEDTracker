import type { AuditFinding } from '../core/finding';
import { auditConfig } from '../core/config';
import { fileExists, readTextFile } from '../core/fileScanner';

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

