import dayjs from '../../utils/dayjsSetup';
import { EngineState, EngineEvent } from '../contracts/types';
import { initialState } from '../state/initialState';

export function workTrackerReducer(state: EngineState = initialState, event: EngineEvent): EngineState {
  switch (event.type) {
    case 'APP_INIT':
    case 'START_SESSION_REQUEST':
    case 'STOP_SESSION_REQUEST':
    case 'SETTINGS_UPDATE_REQUEST':
      return { ...state, isLoading: true, error: null };

    case 'SET_LOADING':
      return { ...state, isLoading: event.isLoading };

    case 'DATA_LOADED':
      return {
        ...state,
        ...event.state,
        isLoading: false,
        error: null,
        lastUpdated: dayjs().valueOf()
      };

    case 'ERROR_OCCURRED':
      return { ...state, error: event.error, isLoading: false };

    case 'BACKGROUND_SESSION_TIMEOUT':
      // This event shouldn't set loading because it's a background sync
      return state;

    default:
      return state;
  }
}
