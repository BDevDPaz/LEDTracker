import { resolveNotificationRoute } from '../notificationRouting';

describe('resolveNotificationRoute', () => {
  it('GEOFENCE_EXIT abre PostWorkModal en Home', () => {
    expect(resolveNotificationRoute({ type: 'GEOFENCE_EXIT', sessionId: 42 })).toEqual({
      pathname: '/(tabs)',
      params: { showPostWork: 'true', postWorkSessionId: '42' },
    });
  });

  it('GEOFENCE_EXIT tiene prioridad sobre action', () => {
    expect(
      resolveNotificationRoute({ type: 'GEOFENCE_EXIT', action: 'CHECKOUT_DECISION' })?.params
    ).toMatchObject({ showPostWork: 'true' });
  });

  it('mantiene las rutas existentes', () => {
    expect(resolveNotificationRoute({ action: 'OPEN_DAILY_SETUP' })).toEqual({
      pathname: '/(tabs)', params: { showSetup: 'true' },
    });
    expect(resolveNotificationRoute({ action: 'SHOW_REPORT_PROMPT' })).toEqual({ pathname: '/(tabs)/report' });
    expect(resolveNotificationRoute({ action: 'GENERATE_REPORT_PROMPT' })).toEqual({ pathname: '/(tabs)/report' });
    expect(resolveNotificationRoute({ action: 'CHECKOUT_DECISION' })).toEqual({
      pathname: '/(tabs)', params: { showCheckoutPrompt: 'true' },
    });
  });

  it('ignora payloads vacíos o desconocidos', () => {
    expect(resolveNotificationRoute(undefined)).toBeNull();
    expect(resolveNotificationRoute({})).toBeNull();
    expect(resolveNotificationRoute({ action: 'X' })).toBeNull();
  });
});
