import AsyncStorage from '@react-native-async-storage/async-storage';

import { reconcileRuntimeState } from '../../runtime/runtimeSupervisor';
import { EngineEvent, EngineState } from '../contracts/types';
import {
  getActiveSession,
  getSettings,
  saveSession,
  updateSessionStatus,
  getAllAsync,
  saveSettings
} from '../../database/db';
import { EXIT_TIMESTAMP_KEY, LocationService } from '../../services/LocationManager';
import dayjs from '../../utils/dayjsSetup';
import { AUDIT_ACTIONS, log } from '../../utils/logger';
import { securityAdapter } from '../../runtime/securityAdapter';
import { runDatabaseWork } from '../../database/dbWorkQueue';

export async function workTrackerEffects(
  event: EngineEvent,
  state: EngineState,
  dispatch: (event: EngineEvent) => void
) {
  try {
    switch (event.type) {
      case 'APP_INIT': {
        await runDatabaseWork('app-init', async () => {
          const settings = await getSettings();

          // Ensure monitoring is active for all pending sessions.
          const pendingForInit = await getAllAsync<any>(
            "SELECT id, latitude, longitude FROM work_sessions WHERE status = 'pending_arrival' AND date_string = ?",
            [dayjs().format('YYYY-MM-DD')]
          );

          if (pendingForInit.length > 0) {
            const initSites = pendingForInit.map((s) => ({
              id: s.id.toString(),
              latitude: s.latitude,
              longitude: s.longitude,
            }));

            const initRadius = settings?.tolerance_radius || 200;
            await LocationService.startMonitoringArrival(initSites, initRadius);
          }

          await reconcileRuntimeState('APP_INIT');

          const reconciledSession = await getActiveSession();

          dispatch({
            type: 'DATA_LOADED',
            state: {
              activeSession: reconciledSession,
              settings,
            },
          });
        });

        break;
      }

      case 'SYNC_ACTIVE_SESSION': {
        const session = await getActiveSession();
        dispatch({ type: 'DATA_LOADED', state: { activeSession: session } });
        break;
      }

      case 'START_SESSION_REQUEST': {
        const sanitizedAddress = securityAdapter.sanitizeInput(event.address);
        const sanitizedClient = event.client
          ? securityAdapter.sanitizeInput(event.client)
          : undefined;
        const sanitizedNotes = event.notes
          ? securityAdapter.sanitizeInput(event.notes)
          : undefined;

        const coords = await LocationService.getCoordsFromAddress(sanitizedAddress);
        if (!coords) {
          dispatch({ type: 'ERROR_OCCURRED', error: 'Address not found' });
          return;
        }

        const currentSettings = state.settings || await getSettings();
        const radius = currentSettings?.tolerance_radius || 200;

        await saveSession({
          address: sanitizedAddress,
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
          client_name: sanitizedClient,
          manual_note: sanitizedNotes,
        });

        // Monitor all pending sessions for today
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
          await updateSessionStatus(
            state.activeSession.id,
            'completed',
            event.lunchMinutes,
            AUDIT_ACTIONS.MANUAL_CHECKOUT
          );

          await AsyncStorage.removeItem(EXIT_TIMESTAMP_KEY);

          // Only stop monitoring if no more active/pending sessions exist for today
          const pendingSessions = await getAllAsync<any>(
            "SELECT id FROM work_sessions WHERE status = 'pending_arrival' AND date_string = ?",
            [dayjs().format('YYYY-MM-DD')]
          );

          if (pendingSessions.length === 0) {
            await LocationService.stopMonitoring();
          } else {
            // If there are still pending sessions, just re-sync monitoring to exclude the current one
            const initSites = pendingSessions.map(s => ({
              id: s.id.toString(),
              latitude: s.latitude,
              longitude: s.longitude,
            }));
            const currentSettings = state.settings || await getSettings();
            const radius = currentSettings?.tolerance_radius || 200;
            await LocationService.startMonitoringArrival(initSites, radius);
          }

          dispatch({ type: 'DATA_LOADED', state: { activeSession: null } });
        } else {
          dispatch({ type: 'SET_LOADING', isLoading: false });
        }
        break;

      case 'SETTINGS_UPDATE_REQUEST': {
        await saveSettings(event.settings);
        dispatch({ type: 'DATA_LOADED', state: { settings: event.settings } });
        break;
      }

      case 'BACKGROUND_SESSION_TIMEOUT': {
        // Ejecución secuencial para seguridad con SQLite
        const reSession = await getActiveSession();
        const reSettings = await getSettings();
        dispatch({
          type: 'DATA_LOADED',
          state: {
            activeSession: reSession,
            settings: reSettings,
          },
        });
        break;
      }
    }
  } catch (error) {
    log('ROJO', 'ERROR_CRITICO', 'ERROR', 'Effect error', error);
    dispatch({ type: 'ERROR_OCCURRED', error: String(error) });
  }
}

