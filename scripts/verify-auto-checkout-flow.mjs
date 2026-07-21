import fs from 'fs';

const files = [
  'src/services/LocationManager.ts',
  'src/services/BackgroundTasks.ts',
  'src/services/Notifications.ts',
  'src/services/NotificationDispatcher.ts',
  'src/database/db.ts',
  'src/utils/geoUtils.ts',
];

function read(file) {
  if (!fs.existsSync(file)) return '';
  return fs.readFileSync(file, 'utf8');
}

function stripComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

const raw = Object.fromEntries(files.map((file) => [file, read(file)]));
const code = Object.fromEntries(
  Object.entries(raw).map(([file, text]) => [file, stripComments(text)])
);

const checks = [
  {
    id: 'AUTO_CHECKOUT_ACTION',
    desc: 'Existe action_type o semántica de Auto Check-out GPS',
    files: ['src/services/LocationManager.ts', 'src/database/db.ts'],
    pattern: /AUTO_CHECKOUT_GPS|AUTO_CHECKOUT|AUTO_SALIDA/,
  },
  {
    id: 'FAILSAFE_ACTION',
    desc: 'Existe semántica de Auto Check-out Failsafe',
    files: ['src/services/BackgroundTasks.ts', 'src/database/db.ts'],
    pattern: /AUTO_CHECKOUT_FAILSAFE/,
  },
  {
    id: 'EXIT_DISTANCE_THRESHOLD',
    desc: 'Existe umbral de salida de 3.2 km o 3200 metros',
    files: ['src/services/LocationManager.ts', 'src/utils/geoUtils.ts'],
    pattern: /3200|3\.2|EXIT_DISTANCE|CHECKOUT_DISTANCE|exitDistance/i,
  },
  {
    id: 'DISTANCE_CALCULATION',
    desc: 'Existe cálculo de distancia para comparar ubicación actual contra sitio',
    files: ['src/services/LocationManager.ts', 'src/utils/geoUtils.ts'],
    pattern: /getDistanceFromLatLonInMeters|distance|haversine/i,
  },
  {
    id: 'SESSION_COMPLETION',
    desc: 'Existe cierre de sesión a completed/end_time en flujo de salida',
    files: ['src/services/LocationManager.ts', 'src/database/db.ts'],
    pattern: /completed|end_time|checkout|checkOut|completeSession|finishSession/i,
  },
  {
    id: 'TRACKING_CLEANUP',
    desc: 'Existe apagado/limpieza de tracking o geofencing',
    files: ['src/services/LocationManager.ts', 'src/services/BackgroundTasks.ts'],
    pattern: /stopGeofencingAsync|stopLocationUpdatesAsync|stopMonitoring|clear|removeItem|cleanup|detenidos|Storage limpio/i,
  },
  {
    id: 'GEOFENCE_EXIT_NOTIFICATION',
    desc: 'Existe notificación/evento GEOFENCE_EXIT o salida registrada',
    files: [
      'src/services/LocationManager.ts',
      'src/services/Notifications.ts',
      'src/services/NotificationDispatcher.ts',
    ],
    pattern: /GEOFENCE_EXIT|Salida registrada|salida registrada|exit/i,
  },
];

let failures = 0;

for (const check of checks) {
  const matchedFiles = check.files.filter((file) => check.pattern.test(code[file] || ''));

  if (matchedFiles.length > 0) {
    console.log(`PASS ${check.id}: ${check.desc}`);
    for (const file of matchedFiles) {
      console.log(`  - ${file}`);
    }
  } else {
    failures++;
    console.log(`FAIL ${check.id}: ${check.desc}`);
  }
}

console.log('');
console.log(`Resultado: ${failures === 0 ? 'PASS' : 'FAIL'} (${checks.length - failures}/${checks.length})`);

process.exit(failures === 0 ? 0 : 1);
