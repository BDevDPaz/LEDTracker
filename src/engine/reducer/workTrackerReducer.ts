import dayjs from '../../utils/dayjsSetup';
import { EngineState, EngineEvent } from '../contracts/types';
import { initialState } from '../state/initialState';

export function workTrackerReducer(state: EngineState = initialState, event: EngineEvent): EngineState {
  switch (event.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: event.isLoading };
    case 'DATA_LOADED':
      return { ...state, ...event.state, isLoading: false, error: null, lastUpdated: dayjs().valueOf() };
    case 'ERROR_OCCURRED':
      return { ...state, error: event.error, isLoading: false };
    default:
      return state;
  }
}
