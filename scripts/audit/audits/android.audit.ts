import type { AuditFinding } from '../core/finding';
import { auditConfig } from '../core/config';
import { fileExists, readJsonFile } from '../core/fileScanner';

interface AppJson {
  expo?: {
    experiments?: {
      typedRoutes?: boolean;
      reactCompiler?: boolean;
    };
    android?: {
      package?: string;
      permissions?: string[];
    };
    ios?: {
      infoPlist?: {
        UIBackgroundModes?: string[];
      };
    };
    plugins?: unknown[];
  };
}

export async function runAndroidAudit(): Promise<AuditFinding[]> {
  const findings: AuditFinding[] = [];
  const file = auditConfig.criticalFiles.appJson;

  if (!fileExists(file)) {
    return [
      {
        id: 'ANDROID-001',
        domain: 'android',
        severity: 'critical',
        title: 'app.json missing',
        description: 'Expo app.json was not found.',
        recommendation:
          'Restore app.json because Android permissions and Expo plugins are release-critical.',
        file
      }
    ];
  }

  const appJson = readJsonFile<AppJson>(file);

  if (!appJson.expo?.android?.package) {
    findings.push({
      id: 'ANDROID-002',
      domain: 'android',
      severity: 'high',
      title: 'Android package missing',
      description:
        'expo.android.package is not configured.',
      recommendation:
        'Set a stable Android package identifier for production builds.',
      file
    });
  }

  if (appJson.expo?.experiments?.typedRoutes !== true) {
    findings.push({
      id: 'ANDROID-003',
      domain: 'android',
      severity: 'low',
      title: 'Expo typedRoutes not enabled',
      description:
        'typedRoutes is not enabled in app.json experiments.',
      recommendation:
        'Enable typedRoutes to improve route safety with Expo Router.',
      file
    });
  }

  if (appJson.expo?.experiments?.reactCompiler !== true) {
    findings.push({
      id: 'ANDROID-004',
      domain: 'android',
      severity: 'medium',
      title: 'React Compiler not enabled',
      description:
        'reactCompiler is not enabled in app.json experiments.',
      recommendation:
        'Keep React Compiler explicitly enabled if this Gold Master depends on it.',
      file
    });
  }

  const iosModes = appJson.expo?.ios?.infoPlist?.UIBackgroundModes ?? [];

  if (!iosModes.includes('location')) {
    findings.push({
      id: 'ANDROID-005',
      domain: 'android',
      severity: 'low',
      title: 'iOS background location mode not detected',
      description:
        'UIBackgroundModes does not include location.',
      recommendation:
        'If iOS support is planned, explicitly configure background location or document Android-only support.',
      file
    });
  }

  return findings;
}
