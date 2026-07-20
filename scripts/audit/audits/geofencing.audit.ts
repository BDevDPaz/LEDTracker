import type { AuditFinding } from '../core/finding';
import { auditConfig } from '../core/config';
import { fileExists, readJsonFile, readTextFile } from '../core/fileScanner';

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
  }

  return findings;
}
