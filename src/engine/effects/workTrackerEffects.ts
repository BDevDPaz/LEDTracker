import { EngineEvent, EngineState } from '../contracts/types';
import { getActiveSession, getSettings, saveSession, updateSessionStatus } from '../../database/db';
import { LocationService } from '../../services/LocationManager';
import dayjs from '../../utils/dayjsSetup';
import { log } from '../../utils/logger';

export async function workTrackerEffects(event: EngineEvent, state: EngineState, dispatch: (event: EngineEvent) => void) {
  try {
    switch (event.type) {
      case 'APP_INIT':
        dispatch({ type: 'SET_LOADING', isLoading: true });
        const [session, settings] = await Promise.all([getActiveSession(), getSettings()]);
        dispatch({ type: 'DATA_LOADED', state: { activeSession: session, settings } });
        break;

      case 'START_SESSION_REQUEST':
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

        await LocationService.startMonitoringArrival(coords.latitude, coords.longitude, radius);
        const newSession = await getActiveSession();
        dispatch({ type: 'DATA_LOADED', state: { activeSession: newSession } });
        break;

      case 'STOP_SESSION_REQUEST':
        if (state.activeSession?.id) {
          dispatch({ type: 'SET_LOADING', isLoading: true });
          await updateSessionStatus(state.activeSession.id, 'completed', event.lunchMinutes);
          await LocationService.stopMonitoring();
          dispatch({ type: 'DATA_LOADED', state: { activeSession: null } });
        }
        break;
    }
  } catch (error) {
    log('ROJO', 'ERROR_CRITICO', 'ERROR', 'Effect error', error);
    dispatch({ type: 'ERROR_OCCURRED', error: String(error) });
  }
}
