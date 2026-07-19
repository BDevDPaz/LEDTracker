import type { AuditFinding } from '../core/finding';
import { auditConfig } from '../core/config';
import { fileExists, readTextFile, findLineNumber } from '../core/fileScanner';

export async function runDatabaseAudit(): Promise<AuditFinding[]> {
  const findings: AuditFinding[] = [];
  const dbFile = auditConfig.criticalFiles.db;

  if (!fileExists(dbFile)) {
    return [
      {
        id: 'DB-001',
        domain: 'database',
        severity: 'critical',
        title: 'Database module missing',
        description: `Database file not found: ${dbFile}`,
        recommendation: 'Restore src/database/db.ts or update auditConfig.criticalFiles.db.',
        file: dbFile
      }
    ];
  }

  const content = readTextFile(dbFile);

  if (!content.includes('journal_mode') || !content.toLowerCase().includes('wal')) {
    findings.push({
      id: 'DB-002',
      domain: 'database',
      severity: 'high',
      title: 'WAL mode not clearly enabled',
      description:
        'The database module does not clearly contain PRAGMA journal_mode=WAL or equivalent WAL activation.',
      recommendation:
        'Enable and verify SQLite WAL mode during database initialization, then log the result.',
      file: dbFile,
      line: findLineNumber(content, 'journal_mode')
    });
  }

  const criticalDbFunctionGroups = [
    {
      label: 'checkSessionOverlap',
      alternatives: ['checkSessionOverlap'],
      severity: 'critical' as const
    },
    {
      label: 'createSession',
      alternatives: ['createSession', 'insertWorkSession'],
      severity: 'medium' as const
    },
    {
      label: 'updateSession',
      alternatives: ['updateSessionStatus', 'updateWorkSessionManual', 'updateSession'],
      severity: 'medium' as const
    },
    {
      label: 'deleteSession',
      alternatives: ['deleteSession', 'deleteWorkSession'],
      severity: 'medium' as const
    },
    {
      label: 'closeSession',
      alternatives: ['closeSession', 'updateSessionEndTime'],
      severity: 'medium' as const
    },
    {
      label: 'getOpenSession',
      alternatives: ['getOpenSession', 'getActiveSession'],
      severity: 'medium' as const
    }
  ];

  for (const functionGroup of criticalDbFunctionGroups) {
    const detected = functionGroup.alternatives.some((functionName) =>
      content.includes(functionName)
    );

    if (!detected) {
      findings.push({
        id: 'DB-003',
        domain: 'database',
        severity: functionGroup.severity,
        title: `Expected database function family not detected: ${functionGroup.label}`,
        description:
          `The audit could not find any accepted implementation name for "${functionGroup.label}" in ${dbFile}.`,
        recommendation:
          `Implement or restore one of: ${functionGroup.alternatives.join(', ')}.`,
        file: dbFile,
        evidence: functionGroup.alternatives.join(', ')
      });
    }
  }

  const hasTransactions =
    content.includes('withTransactionAsync') ||
    content.includes('transaction') ||
    content.includes('BEGIN') ||
    content.includes('COMMIT');

  if (!hasTransactions) {
    findings.push({
      id: 'DB-004',
      domain: 'database',
      severity: 'high',
      title: 'No explicit transaction pattern detected',
      description:
        'Critical work-session operations should be protected by SQLite transactions.',
      recommendation:
        'Wrap session creation, updates, deletion and audit logging in explicit transactions.',
      file: dbFile
    });
  }

  const writes = ['INSERT', 'UPDATE', 'DELETE'];
  for (const write of writes) {
    if (content.toUpperCase().includes(write) && !content.toLowerCase().includes('audit')) {
      findings.push({
        id: 'DB-005',
        domain: 'database',
        severity: 'medium',
        title: `Database write detected without obvious audit coupling: ${write}`,
        description:
          'A database write operation exists, but the file does not clearly show audit logging nearby.',
        recommendation:
          'Ensure every critical write emits an audit event with session_id, action_type, details and timestamp.',
        file: dbFile,
        line: findLineNumber(content.toUpperCase(), write)
      });
    }
  }

  const expectedCheckoutSemantics = [
    'MANUAL_CHECKOUT',
    'AUTO_CHECKOUT_GPS',
    'AUTO_CHECKOUT_FAILSAFE'
  ];

  for (const checkoutAction of expectedCheckoutSemantics) {
    if (!content.includes(checkoutAction)) {
      findings.push({
        id: 'DB-006',
        domain: 'database',
        severity: 'high',
        title: `Checkout semantic action not detected in database layer: ${checkoutAction}`,
        description:
          `The database layer does not clearly reference "${checkoutAction}". Completed sessions should be closed with explicit checkout semantics.`,
        recommendation:
          'Ensure session completion paths receive and persist MANUAL_CHECKOUT, AUTO_CHECKOUT_GPS or AUTO_CHECKOUT_FAILSAFE explicitly.',
        file: dbFile,
        evidence: checkoutAction
      });
    }
  }

  const ambiguousCompletedInferencePatterns = [
    "status === 'completed' ? AUDIT_ACTIONS.AUTO_CHECKOUT : AUDIT_ACTIONS.MANUAL",
    'status === "completed" ? AUDIT_ACTIONS.AUTO_CHECKOUT : AUDIT_ACTIONS.MANUAL',
    "status === 'completed' ? AUDIT_ACTIONS.AUTO_CHECKOUT",
    'status === "completed" ? AUDIT_ACTIONS.AUTO_CHECKOUT'
  ];

  for (const pattern of ambiguousCompletedInferencePatterns) {
    if (content.includes(pattern)) {
      findings.push({
        id: 'DB-007',
        domain: 'database',
        severity: 'critical',
        title: 'Ambiguous completed-session audit inference detected',
        description:
          'The database layer appears to infer AUTO_CHECKOUT or MANUAL from status === completed.',
        recommendation:
          'Completed session updates must receive an explicit checkout audit action instead of inferring AUTO_CHECKOUT or MANUAL.',
        file: dbFile,
        line: findLineNumber(content, pattern),
        evidence: pattern
      });
    }
  }

  const directGenericCheckoutPatterns = [
    'action_type: AUDIT_ACTIONS.AUTO_CHECKOUT',
    'AUDIT_ACTIONS.AUTO_CHECKOUT,',
    "'AUTO_CHECKOUT'",
    '"AUTO_CHECKOUT"'
  ];

  for (const pattern of directGenericCheckoutPatterns) {
    if (content.includes(pattern)) {
      findings.push({
        id: 'DB-008',
        domain: 'database',
        severity: 'high',
        title: 'Generic AUTO_CHECKOUT detected in database close path',
        description:
          'The database layer should not use generic AUTO_CHECKOUT for new completed-session writes.',
        recommendation:
          'Use MANUAL_CHECKOUT, AUTO_CHECKOUT_GPS or AUTO_CHECKOUT_FAILSAFE for new checkout close flows. Keep AUTO_CHECKOUT only as read-time legacy mapping outside DB writes.',
        file: dbFile,
        line: findLineNumber(content, pattern),
        evidence: pattern
      });
    }
  }

  const legacyEndTimeSignature = 'updateSessionEndTime = async (id: number, endTime: number)';

  if (content.includes(legacyEndTimeSignature)) {
    findings.push({
      id: 'DB-009',
      domain: 'database',
      severity: 'critical',
      title: 'updateSessionEndTime lacks explicit checkout action',
      description:
        'updateSessionEndTime still appears to accept only id and endTime.',
      recommendation:
        'Require checkoutAction: CheckoutAuditAction when ending a session.',
      file: dbFile,
      line: findLineNumber(content, legacyEndTimeSignature),
      evidence: legacyEndTimeSignature
    });
  }

  if (!content.includes('CheckoutAuditAction')) {
    findings.push({
      id: 'DB-010',
      domain: 'database',
      severity: 'high',
      title: 'CheckoutAuditAction not detected in database layer',
      description:
        'The database layer does not clearly use CheckoutAuditAction.',
      recommendation:
        'Type session completion APIs with CheckoutAuditAction to prevent ambiguous action_type writes.',
      file: dbFile,
      evidence: 'CheckoutAuditAction'
    });
  }

  if (!content.includes('isOfficialCheckoutAuditAction')) {
    findings.push({
      id: 'DB-011',
      domain: 'database',
      severity: 'medium',
      title: 'Official checkout action validation not detected',
      description:
        'The database layer does not clearly validate checkout actions against official checkout audit actions.',
      recommendation:
        'Validate completed-session writes with isOfficialCheckoutAuditAction or an equivalent central helper.',
      file: dbFile,
      evidence: 'isOfficialCheckoutAuditAction'
    });
  }

  const requiredEndTimeSignatureParts = [
    'updateSessionEndTime',
    'endTime: number',
    'checkoutAction: CheckoutAuditAction'
  ];

  for (const signaturePart of requiredEndTimeSignatureParts) {
    if (!content.includes(signaturePart)) {
      findings.push({
        id: 'DB-012',
        domain: 'database',
        severity: 'high',
        title: `updateSessionEndTime signature invariant missing: ${signaturePart}`,
        description:
          'The failsafe checkout path depends on updateSessionEndTime accepting a real endTime and explicit checkoutAction.',
        recommendation:
          'Keep updateSessionEndTime typed as updateSessionEndTime(id, endTime, checkoutAction: CheckoutAuditAction).',
        file: dbFile,
        line: findLineNumber(content, 'updateSessionEndTime'),
        evidence: signaturePart
      });
    }
  }

  const requiredOfficialCheckoutReferences = [
    'AUDIT_ACTIONS.MANUAL_CHECKOUT',
    'AUDIT_ACTIONS.AUTO_CHECKOUT_GPS',
    'AUDIT_ACTIONS.AUTO_CHECKOUT_FAILSAFE'
  ];

  for (const reference of requiredOfficialCheckoutReferences) {
    if (!content.includes(reference)) {
      findings.push({
        id: 'DB-013',
        domain: 'database',
        severity: 'high',
        title: `Official checkout reference missing in database layer: ${reference}`,
        description:
          'The database layer should keep official checkout actions explicit and separated.',
        recommendation:
          'Keep MANUAL_CHECKOUT, AUTO_CHECKOUT_GPS and AUTO_CHECKOUT_FAILSAFE referenced as separate official checkout actions.',
        file: dbFile,
        evidence: reference
      });
    }
  }

  const riskyCheckoutConflationPatterns = [
    'AUTO_CHECKOUT_FAILSAFE = AUTO_CHECKOUT_GPS',
    'AUTO_CHECKOUT_GPS = AUTO_CHECKOUT_FAILSAFE',
    'AUTO_CHECKOUT_FAILSAFE: AUTO_CHECKOUT_GPS',
    'AUTO_CHECKOUT_GPS: AUTO_CHECKOUT_FAILSAFE'
  ];

  for (const pattern of riskyCheckoutConflationPatterns) {
    if (content.includes(pattern)) {
      findings.push({
        id: 'DB-014',
        domain: 'database',
        severity: 'critical',
        title: 'Checkout action conflation detected in database layer',
        description:
          'AUTO_CHECKOUT_FAILSAFE and AUTO_CHECKOUT_GPS must remain distinct completed-session semantics.',
        recommendation:
          'Keep failsafe checkout and GPS checkout as separate actions throughout database writes and audit logs.',
        file: dbFile,
        line: findLineNumber(content, pattern),
        evidence: pattern
      });
    }
  }

  return findings;
}

