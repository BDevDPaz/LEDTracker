export const RUNTIME_POLICY = {
  GPS_ACCEPTED_ACCURACY_M: 50,
  REQUIRED_STABLE_GEOFENCE_SAMPLES: 3,
  DEFAULT_RECONCILE_RADIUS_M: 200,
  /** README: radio de entrada (geocerca de llegada) en metros. */
  GEOFENCE_ENTRY_RADIUS_M: 150,
  /** README: distancia al sitio a partir de la cual se considera salida (auto check-out). */
  WORKSITE_EXIT_DISTANCE_M: 3200,
  /** Intervalo/distancia mínimos para el rastreo continuo en segundo plano. */
  WORKSITE_TRACKING_INTERVAL_MS: 60 * 1000,
  WORKSITE_TRACKING_DISTANCE_INTERVAL_M: 50,
  EXIT_FAILSAFE_THRESHOLD_MS: 45 * 60 * 1000,
  STALE_EXIT_TIMESTAMP_MS: 12 * 60 * 60 * 1000,
  LOCATION_EVIDENCE_RETENTION_DAYS: 7,
  LOCATION_EVIDENCE_MAX_ROWS: 5000,
  LOCATION_EVIDENCE_CLEANUP_MIN_INTERVAL_MS: 5 * 60 * 1000,
} as const;
