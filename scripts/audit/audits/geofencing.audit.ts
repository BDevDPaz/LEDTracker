import type { AuditFinding } from '../core/finding';
import { auditConfig } from '../core/config';
import { fileExists, readJsonFile, readTextFile, findLineNumber } from '../core/fileScanner';

interface AppJson {
  expo?: {
    android?: {
      permissions?: string[];
    };
    plugins?: unknown[];
  };
}

export async function runGeofencingAudit(): Promise<AuditFinding[]> {
  const findings: AuditFinding[] = [];
  const locationFile = auditConfig.criticalFiles.locationManager;
  const backgroundFile = auditConfig.criticalFiles.backgroundTasks;
  const runtimeSupervisorFile =
    (auditConfig.criticalFiles as Record<string, string>).runtimeSupervisor ??
    'src/runtime/runtimeSupervisor.ts';

  if (!fileExists(locationFile)) {
    findings.push({
      id: 'GEO-001',
      domain: 'geofencing',
      severity: 'critical',
      title: 'LocationManager module missing',
      description: `Expected geofencing module not found: ${locationFile}`,
      recommendation:
        'Restore LocationManager.ts or update auditConfig. Geofence registration must be auditable.',
      file: locationFile
    });
  }

  if (!fileExists(backgroundFile)) {
    findings.push({
      id: 'GEO-002',
      domain: 'geofencing',
      severity: 'critical',
      title: 'BackgroundTasks module missing',
      description: `Expected background task module not found: ${backgroundFile}`,
      recommendation:
        'Restore BackgroundTasks.ts or update auditConfig. Geofence events require background handling.',
      file: backgroundFile
    });
  }

  if (!fileExists(runtimeSupervisorFile)) {
    findings.push({
      id: 'GEO-008',
      domain: 'geofencing',
      severity: 'critical',
      title: 'Runtime supervisor module missing',
      description:
        `Expected runtime reconciliation module not found: ${runtimeSupervisorFile}`,
      recommendation:
        'Restore src/runtime/runtimeSupervisor.ts. Fase D runtime reconciliation depends on reconcileRuntimeState.',
      file: runtimeSupervisorFile
    });
  }

  if (fileExists(auditConfig.criticalFiles.appJson)) {
    const appJson = readJsonFile<AppJson>(auditConfig.criticalFiles.appJson);
    const permissions = appJson.expo?.android?.permissions ?? [];

    const requiredPermissions = [
      'ACCESS_COARSE_LOCATION',
      'ACCESS_FINE_LOCATION',
      'ACCESS_BACKGROUND_LOCATION',
      'FOREGROUND_SERVICE',
      'FOREGROUND_SERVICE_LOCATION',
      'POST_NOTIFICATIONS'
    ];

    for (const permission of requiredPermissions) {
      if (!permissions.includes(permission)) {
        findings.push({
          id: 'GEO-003',
          domain: 'geofencing',
          severity: 'high',
          title: `Missing Android permission: ${permission}`,
          description:
            `app.json does not declare required permission "${permission}".`,
          recommendation:
            'Add the permission if background geofencing and user notification are required for production.',
          file: auditConfig.criticalFiles.appJson
        });
      }
    }

    const pluginsText = JSON.stringify(appJson.expo?.plugins ?? []);

    if (!pluginsText.includes('isAndroidBackgroundLocationEnabled')) {
      findings.push({
        id: 'GEO-004',
        domain: 'geofencing',
        severity: 'high',
        title: 'Expo background location plugin option not detected',
        description:
          'The expo-location plugin does not clearly enable Android background location.',
        recommendation:
          'Ensure expo-location has isAndroidBackgroundLocationEnabled enabled when background geofencing is core functionality.',
        file: auditConfig.criticalFiles.appJson
      });
    }
  }

  if (fileExists(locationFile)) {
    const content = readTextFile(locationFile);

    const expectedPatterns = [
      'startGeofencingAsync',
      'stopGeofencingAsync',
      'requestForegroundPermissionsAsync',
      'requestBackgroundPermissionsAsync',
      'getCurrentPositionAsync'
    ];

    for (const pattern of expectedPatterns) {
      if (!content.includes(pattern)) {
        findings.push({
          id: 'GEO-005',
          domain: 'geofencing',
          severity:
            pattern === 'startGeofencingAsync' || pattern === 'stopGeofencingAsync'
              ? 'high'
              : 'medium',
          title: `Expected geofencing/location API not detected: ${pattern}`,
          description:
            `LocationManager.ts does not clearly reference "${pattern}".`,
          recommendation:
            'Verify that geofence registration, cleanup, permission handling and GPS warm-up are implemented intentionally.',
          file: locationFile
        });
      }
    }

    if (!content.toLowerCase().includes('accuracy')) {
      findings.push({
        id: 'GEO-006',
        domain: 'geofencing',
        severity: 'medium',
        title: 'GPS accuracy handling not clearly detected',
        description:
          'LocationManager.ts does not clearly handle GPS accuracy.',
        recommendation:
          'Record accuracy in logs and reject/flag low-confidence GPS decisions.',
        file: locationFile
      });
    }

    if (!content.toLowerCase().includes('overwrite')) {
      findings.push({
        id: 'GEO-007',
        domain: 'geofencing',
        severity: 'low',
        title: 'Overwrite geofence strategy not explicitly documented in code',
        description:
          'The architectural overwrite pattern was not detected by name.',
        recommendation:
          'Consider documenting the overwrite strategy in code comments or function names for auditability.',
        file: locationFile
      });
    }

    const locationRuntimeInvariants = [
      {
        pattern: 'export const EXIT_TIMESTAMP_KEY',
        id: 'GEO-009',
        title: 'EXIT_TIMESTAMP_KEY export missing',
        description:
          'LocationManager.ts does not clearly export EXIT_TIMESTAMP_KEY.',
        recommendation:
          'Keep EXIT_TIMESTAMP_KEY exported so BackgroundTasks and manual checkout cleanup share the same storage key.'
      },
      {
        pattern: 'LAST_GEOFENCE_EXIT_TIMESTAMP',
        id: 'GEO-010',
        title: 'Stored geofence exit timestamp key missing',
        description:
          'LocationManager.ts does not clearly define the persistent geofence exit timestamp key.',
        recommendation:
          'Keep LAST_GEOFENCE_EXIT_TIMESTAMP stable to preserve failsafe checkout behavior.'
      },
      {
        pattern: 'AsyncStorage.setItem(EXIT_TIMESTAMP_KEY',
        id: 'GEO-011',
        title: 'Geofence exit timestamp persistence missing',
        description:
          'LocationManager.ts does not clearly store EXIT_TIMESTAMP_KEY after active-session geofence exit.',
        recommendation:
          'Store EXIT_TIMESTAMP_KEY with the real exit timestamp when an active session exits the geofence.'
      },
      {
        pattern: 'EXIT_TIMESTAMP_STORED',
        id: 'GEO-012',
        title: 'EXIT_TIMESTAMP_STORED log missing',
        description:
          'LocationManager.ts does not clearly emit EXIT_TIMESTAMP_STORED.',
        recommendation:
          'Log EXIT_TIMESTAMP_STORED when persisting the active-session geofence exit timestamp.'
      },
      {
        pattern: 'notifyGeofenceExitDetected',
        id: 'GEO-013',
        title: 'Geofence exit notification missing',
        description:
          'LocationManager.ts does not clearly notify the user after active-session geofence exit.',
        recommendation:
          'Notify the user after storing EXIT_TIMESTAMP_KEY so manual checkout can win before failsafe.'
      },
      {
        pattern: 'AUTO_CHECKIN_GPS',
        id: 'GEO-014',
        title: 'AUTO_CHECKIN_GPS audit action missing from location flow',
        description:
          'LocationManager.ts does not clearly use AUTO_CHECKIN_GPS for GPS arrival reconciliation.',
        recommendation:
          'Keep AUTO_CHECKIN_GPS as the audit action for GPS-based arrival check-in.'
      },
      {
        pattern: 'MIN_ACCURACY_METERS',
        id: 'GEO-015',
        title: 'GPS accuracy threshold missing from location flow',
        description:
          'LocationManager.ts does not clearly expose MIN_ACCURACY_METERS.',
        recommendation:
          'Keep a named GPS accuracy threshold for geofence/runtime location decisions.'
      }
    ];

    for (const invariant of locationRuntimeInvariants) {
      if (!content.includes(invariant.pattern)) {
        findings.push({
          id: invariant.id,
          domain: 'geofencing',
          severity: 'high',
          title: invariant.title,
          description: invariant.description,
          recommendation: invariant.recommendation,
          file: locationFile,
          line: findLineNumber(content, invariant.pattern),
          evidence: invariant.pattern
        });
      }
    }
  }

  if (fileExists(backgroundFile)) {
    const content = readTextFile(backgroundFile);

    const backgroundRuntimeInvariants = [
      {
        pattern: 'runFailsafeCheck',
        id: 'GEO-016',
        title: 'runFailsafeCheck missing from BackgroundTasks',
        description:
          'BackgroundTasks.ts does not clearly expose runFailsafeCheck.',
        recommendation:
          'Keep runFailsafeCheck testable and separated from the native task wrapper.'
      },
      {
        pattern: 'runBackgroundMaintenance',
        id: 'GEO-017',
        title: 'runBackgroundMaintenance missing from BackgroundTasks',
        description:
          'BackgroundTasks.ts does not clearly expose runBackgroundMaintenance.',
        recommendation:
          'Keep background maintenance internally structured for failsafe/report observability.'
      },
      {
        pattern: 'EXIT_TIMESTAMP_KEY',
        id: 'GEO-018',
        title: 'Background failsafe does not reference EXIT_TIMESTAMP_KEY',
        description:
          'BackgroundTasks.ts does not clearly reference EXIT_TIMESTAMP_KEY.',
        recommendation:
          'The failsafe must use EXIT_TIMESTAMP_KEY as the source of truth for the real checkout end_time.'
      },
      {
        pattern: 'updateSessionEndTime',
        id: 'GEO-019',
        title: 'Failsafe close path does not use updateSessionEndTime',
        description:
          'BackgroundTasks.ts does not clearly close sessions through updateSessionEndTime.',
        recommendation:
          'Use updateSessionEndTime(session.id, exitTime, AUTO_CHECKOUT_FAILSAFE) so end_time uses the real exit timestamp.'
      },
      {
        pattern: 'AUDIT_ACTIONS.AUTO_CHECKOUT_FAILSAFE',
        id: 'GEO-020',
        title: 'Failsafe checkout action missing from background task',
        description:
          'BackgroundTasks.ts does not clearly use AUTO_CHECKOUT_FAILSAFE.',
        recommendation:
          'Keep AUTO_CHECKOUT_FAILSAFE as the dedicated action for background failsafe closures.'
      },
      {
        pattern: 'BACKGROUND_FAILSAFE_COMPLETED',
        id: 'GEO-021',
        title: 'Failsafe completion log missing',
        description:
          'BackgroundTasks.ts does not clearly emit BACKGROUND_FAILSAFE_COMPLETED.',
        recommendation:
          'Log BACKGROUND_FAILSAFE_COMPLETED after successful failsafe checkout.'
      }
    ];

    for (const invariant of backgroundRuntimeInvariants) {
      if (!content.includes(invariant.pattern)) {
        findings.push({
          id: invariant.id,
          domain: 'geofencing',
          severity: 'high',
          title: invariant.title,
          description: invariant.description,
          recommendation: invariant.recommendation,
          file: backgroundFile,
          line: findLineNumber(content, invariant.pattern),
          evidence: invariant.pattern
        });
      }
    }

    const requiredFailsafeTimestampPattern =
      'updateSessionEndTime(\n        session.id,\n        exitTime,\n        AUDIT_ACTIONS.AUTO_CHECKOUT_FAILSAFE';

    if (!content.includes(requiredFailsafeTimestampPattern)) {
      findings.push({
        id: 'GEO-022',
        domain: 'geofencing',
        severity: 'critical',
        title: 'Failsafe may not close with stored exit timestamp',
        description:
          'BackgroundTasks.ts does not clearly call updateSessionEndTime with exitTime and AUTO_CHECKOUT_FAILSAFE.',
        recommendation:
          'Keep failsafe checkout as updateSessionEndTime(session.id, exitTime, AUDIT_ACTIONS.AUTO_CHECKOUT_FAILSAFE).',
        file: backgroundFile,
        line: findLineNumber(content, 'updateSessionEndTime'),
        evidence: 'updateSessionEndTime(session.id, exitTime, AUDIT_ACTIONS.AUTO_CHECKOUT_FAILSAFE)'
      });
    }
  }

  if (fileExists(runtimeSupervisorFile)) {
    const content = readTextFile(runtimeSupervisorFile);

    const runtimeSupervisorInvariants = [
      {
        pattern: 'reconcileRuntimeState',
        id: 'GEO-023',
        title: 'reconcileRuntimeState missing',
        description:
          'runtimeSupervisor.ts does not clearly expose reconcileRuntimeState.',
        recommendation:
          'Keep reconcileRuntimeState as the central runtime reconciliation entry point.'
      },
      {
        pattern: 'reconcilePendingArrivalSessions',
        id: 'GEO-024',
        title: 'Pending-arrival runtime reconciliation missing',
        description:
          'runtimeSupervisor.ts does not clearly reconcile pending_arrival sessions.',
        recommendation:
          'Keep pending_arrival GPS reconciliation in runtimeSupervisor so APP_INIT, FOREGROUND and DASHBOARD_REFRESH remain resilient.'
      },
      {
        pattern: 'GPS_SAMPLE_REJECTED_WEAK_ACCURACY',
        id: 'GEO-025',
        title: 'Weak GPS rejection log missing from runtime supervisor',
        description:
          'runtimeSupervisor.ts does not clearly log GPS_SAMPLE_REJECTED_WEAK_ACCURACY.',
        recommendation:
          'Reject weak GPS samples before auto check-in and log GPS_SAMPLE_REJECTED_WEAK_ACCURACY.'
      },
      {
        pattern: 'GPS_SAMPLE_ACCEPTED_FOR_RECONCILIATION',
        id: 'GEO-026',
        title: 'Accepted GPS reconciliation log missing from runtime supervisor',
        description:
          'runtimeSupervisor.ts does not clearly log GPS_SAMPLE_ACCEPTED_FOR_RECONCILIATION.',
        recommendation:
          'Log accepted GPS samples before reconciling pending_arrival sessions.'
      },
      {
        pattern: 'PENDING_ARRIVAL_RECONCILED_TO_ACTIVE',
        id: 'GEO-027',
        title: 'Pending arrival reconciliation success log missing',
        description:
          'runtimeSupervisor.ts does not clearly log PENDING_ARRIVAL_RECONCILED_TO_ACTIVE.',
        recommendation:
          'Log PENDING_ARRIVAL_RECONCILED_TO_ACTIVE after successful runtime auto check-in.'
      },
      {
        pattern: 'registerAutoCheckinGps',
        id: 'GEO-028',
        title: 'Runtime supervisor does not use registerAutoCheckinGps',
        description:
          'runtimeSupervisor.ts does not clearly call registerAutoCheckinGps.',
        recommendation:
          'Use registerAutoCheckinGps for runtime arrival reconciliation to preserve AUTO_CHECKIN_GPS semantics.'
      }
    ];

    for (const invariant of runtimeSupervisorInvariants) {
      if (!content.includes(invariant.pattern)) {
        findings.push({
          id: invariant.id,
          domain: 'geofencing',
          severity: 'high',
          title: invariant.title,
          description: invariant.description,
          recommendation: invariant.recommendation,
          file: runtimeSupervisorFile,
          line: findLineNumber(content, invariant.pattern),
          evidence: invariant.pattern
        });
      }
    }
  }

  return findings;
}

