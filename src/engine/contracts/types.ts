import { WorkSession, AppSettings } from '../../types';
import type { CheckoutAuditAction } from '../../utils/logger';

export { WorkSession, AppSettings };

export type CheckoutKind = CheckoutAuditAction;

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
  | {
      type: 'STOP_SESSION_REQUEST';
      lunchMinutes: number;
      checkoutKind?: Extract<CheckoutKind, 'MANUAL_CHECKOUT'>;
    }
  | { type: 'SETTINGS_UPDATE_REQUEST'; settings: AppSettings }
  | { type: 'ERROR_OCCURRED'; error: string }
  | { type: 'SET_LOADING'; isLoading: boolean }
  | {
      type: 'BACKGROUND_SESSION_TIMEOUT';
      checkoutKind?: Extract<CheckoutKind, 'AUTO_CHECKOUT_FAILSAFE'>;
    }
  | { type: 'SYNC_ACTIVE_SESSION' }; // New event for targeted re-sync

export interface EngineEffect {
  run: (
    event: EngineEvent,
    state: EngineState,
    dispatch: (event: EngineEvent) => void
  ) => Promise<void>;
}

