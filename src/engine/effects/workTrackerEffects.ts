import { EngineEvent, EngineState } from '../contracts/types';
import { getActiveSession, getSettings, saveSession, updateSessionStatus, getAllAsync } from '../../database/db';
import { LocationService } from '../../services/LocationManager';
import dayjs from '../../utils/dayjsSetup';
import { log } from '../../utils/logger';

export async function workTrackerEffects(event: EngineEvent, state: EngineState, dispatch: (event: EngineEvent) => void) {
  try {
    switch (event.type) {
      case 'APP_INIT': {
        dispatch({ type: 'SET_LOADING', isLoading: true });
        const [session, settings] = await Promise.all([getActiveSession(), getSettings()]);

        // Ensure monitoring is active for all pending sessions
        const pendingForInit = await getAllAsync<any>(
          "SELECT id, latitude, longitude FROM work_sessions WHERE status = 'pending_arrival' AND date_string = ?",
          [dayjs().format('YYYY-MM-DD')]
        );

        if (pendingForInit.length > 0) {
          const initSites = pendingForInit.map(s => ({
            id: s.id.toString(),
            latitude: s.latitude,
            longitude: s.longitude,
          }));
          const initRadius = settings?.tolerance_radius || 200;
          await LocationService.startMonitoringArrival(initSites, initRadius);
        }

        dispatch({ type: 'DATA_LOADED', state: { activeSession: session, settings } });
        break;
      }

      case 'START_SESSION_REQUEST': {
        dispatch({ type: 'SET_LOADING', isLoading: true });
        const coords = await LocationService.getCoordsFromAddress(event.address);
        if (!coords) {
          dispatch({ type: 'ERROR_OCCURRED', error: 'Address not found' });
          return;
        }

        const currentSettings = state.settings || await getSettings();
        const radius = currentSettings?.tolerance_radius || 200;

        await saveSession({
          address: event.address,
          latitude: coords.latitude,
          longitude: coords.longitude,
          target_latitude: coords.latitude,
          target_longitude: coords.longitude,
          status: 'pending_arrival',
          start_time: dayjs().valueOf(),
          location_confirmed: 0,
          is_manual_edit: 0,
          lunch_taken: 0,
          date_string: dayjs().format('YYYY-MM-DD'),
          client_name: event.client,
          manual_note: event.notes,
        });

        // Refactor: Monitor all pending sessions for today
        const pendingSessions = await getAllAsync<any>(
          "SELECT id, latitude, longitude FROM work_sessions WHERE status = 'pending_arrival' AND date_string = ?",
          [dayjs().format('YYYY-MM-DD')]
        );

        const sites = pendingSessions.map(s => ({
          id: s.id.toString(),
          latitude: s.latitude,
          longitude: s.longitude,
        }));

        await LocationService.startMonitoringArrival(sites, radius);

        const currentActive = await getActiveSession();
        dispatch({ type: 'DATA_LOADED', state: { activeSession: currentActive } });
        break;
      }

      case 'STOP_SESSION_REQUEST':
        if (state.activeSession?.id) {
          dispatch({ type: 'SET_LOADING', isLoading: true });
          await updateSessionStatus(state.activeSession.id, 'completed', event.lunchMinutes);
          await LocationService.stopMonitoring();
          dispatch({ type: 'DATA_LOADED', state: { activeSession: null } });
        }
        break;

      case 'BACKGROUND_SESSION_TIMEOUT': {
        const [reSession, reSettings] = await Promise.all([getActiveSession(), getSettings()]);
        dispatch({ type: 'DATA_LOADED', state: { activeSession: reSession, settings: reSettings } });
        break;
      }
    }
  } catch (error) {
    log('ROJO', 'ERROR_CRITICO', 'ERROR', 'Effect error', error);
    dispatch({ type: 'ERROR_OCCURRED', error: String(error) });
  }
}
