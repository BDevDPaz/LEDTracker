export type NotificationRoute =
  | { pathname: '/(tabs)'; params?: Record<string, string> }
  | { pathname: '/(tabs)/report'; params?: undefined }
  | null;

/**
 * Traduce el payload `data` de una notificación a una ruta + parámetros.
 * Se usa tanto en arranque en frío (getLastNotificationResponse) como en caliente
 * (addNotificationResponseReceivedListener).
 */
export function resolveNotificationRoute(data: Record<string, unknown> | null | undefined): NotificationRoute {
  if (!data) return null;

  if (data.type === 'GEOFENCE_EXIT') {
    const sessionId = data.sessionId != null ? String(data.sessionId) : '';
    return { pathname: '/(tabs)', params: { showPostWork: 'true', postWorkSessionId: sessionId } };
  }
  if (data.action === 'OPEN_DAILY_SETUP') {
    return { pathname: '/(tabs)', params: { showSetup: 'true' } };
  }
  if (data.action === 'GENERATE_REPORT_PROMPT' || data.action === 'SHOW_REPORT_PROMPT') {
    return { pathname: '/(tabs)/report' };
  }
  if (data.action === 'CHECKOUT_DECISION') {
    return { pathname: '/(tabs)', params: { showCheckoutPrompt: 'true' } };
  }
  return null;
}
