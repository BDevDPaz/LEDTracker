import type { AuditFinding } from '../core/finding';
import { auditConfig } from '../core/config';
import { fileExists, readTextFile } from '../core/fileScanner';

export async function runUiAudit(): Promise<AuditFinding[]> {
  const findings: AuditFinding[] = [];

  const screens = [
    auditConfig.criticalFiles.homeScreen,
    auditConfig.criticalFiles.historyScreen,
    auditConfig.criticalFiles.reportScreen,
    auditConfig.criticalFiles.settingsScreen
  ];

  for (const screen of screens) {
    if (!fileExists(screen)) {
      findings.push({
        id: 'UI-001',
        domain: 'ui',
        severity: 'critical',
        title: 'Critical tab screen missing',
        description: `Expected Expo Router tab screen not found: ${screen}`,
        recommendation:
          'Restore the missing route or update auditConfig if the route was intentionally renamed.',
        file: screen
      });

      continue;
    }

    const content = readTextFile(screen);

    if (!content.includes('testID')) {
      findings.push({
        id: 'UI-002',
        domain: 'ui',
        severity: 'low',
        title: 'No testID detected in critical screen',
        description:
          `The screen ${screen} does not include testID markers.`,
        recommendation:
          'Add testID values to critical buttons, modals and summaries to improve React Native Testing Library coverage.',
        file: screen
      });
    }

    if (
      screen.includes('index.tsx') &&
      !content.toLowerCase().includes('permission') &&
      !content.toLowerCase().includes('location')
    ) {
      findings.push({
        id: 'UI-003',
        domain: 'ui',
        severity: 'medium',
        title: 'Home screen may not expose location permission state',
        description:
          'The home screen should clearly communicate GPS/location permission and tracking status.',
        recommendation:
          'Ensure Home shows location permission state, GPS confidence and check-in/check-out state.',
        file: screen
      });
    }

    if (
      screen.includes('report.tsx') &&
      !content.toLowerCase().includes('pdf') &&
      !content.toLowerCase().includes('report')
    ) {
      findings.push({
        id: 'UI-004',
        domain: 'ui',
        severity: 'medium',
        title: 'Report screen does not clearly reference report/PDF generation',
        description:
          'The report route should expose report generation state and errors.',
        recommendation:
          'Ensure report generation displays loading, success, error and sharing states.',
        file: screen
      });
    }
  }

  return findings;
}
