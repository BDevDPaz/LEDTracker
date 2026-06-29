export const auditConfig = {
  projectName: 'WTracker v2.2 - Gold Master',

  sourceRoots: ['src', 'app'],

  criticalFiles: {
    packageJson: 'package.json',
    tsconfig: 'tsconfig.json',
    appJson: 'app.json',

    db: 'src/database/db.ts',
    logger: 'src/utils/logger.ts',
    dayjsSetup: 'src/utils/dayjsSetup.ts',
    dateUtils: 'src/utils/dateUtils.ts',
    payrollUtils: 'src/utils/payrollUtils.ts',
    geoUtils: 'src/utils/geoUtils.ts',

    backgroundTasks: 'src/services/BackgroundTasks.ts',
    locationManager: 'src/services/LocationManager.ts',
    notifications: 'src/services/Notifications.ts',
    reportGenerator: 'src/services/ReportGenerator.ts',

    homeScreen: 'app/(tabs)/index.tsx',
    historyScreen: 'app/(tabs)/history.tsx',
    reportScreen: 'app/(tabs)/report.tsx',
    settingsScreen: 'app/(tabs)/settings.tsx'
  },

  allowedDateFiles: [
    'src/utils/dayjsSetup.ts',
    'src/utils/dateUtils.ts',
    'src/utils/payrollUtils.ts',
    'scripts/audit'
  ],

  payroll: {
    dailyRegularLimitHours: 8,
    defaultLunchDeductionMinutes: 60,
    defaultOvertimeMultiplier: 1.5
  },

  auditFailurePolicy: {
    failOnCritical: true,
    failOnHigh: true,
    failOnMedium: false
  }
} as const;
