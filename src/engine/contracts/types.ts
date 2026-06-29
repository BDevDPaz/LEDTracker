import { WorkSession, AppSettings } from '../../types';

export interface EngineState {
  activeSession: WorkSession | null;
  settings: AppSettings | null;
  isLoading: boolean;
  error: string | null;
  lastUpdated: number;
}

export type EngineEvent =
  | { type: 'APP_INIT' }
  | { type: 'DATA_LOADED'; state: Partial<EngineState> }
  | { type: 'START_SESSION_REQUEST'; address: string; client: string; notes: string }
  | { type: 'STOP_SESSION_REQUEST'; lunchMinutes: number }
  | { type: 'SETTINGS_UPDATE_REQUEST'; settings: AppSettings }
  | { type: 'ERROR_OCCURRED'; error: string }
  | { type: 'SET_LOADING'; isLoading: boolean };

export interface EngineEffect {
  run: (event: EngineEvent, state: EngineState, dispatch: (event: EngineEvent) => void) => Promise<void>;
}
