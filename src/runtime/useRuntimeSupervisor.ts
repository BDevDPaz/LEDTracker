import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';

import { reconcileRuntimeState } from './runtimeSupervisor';
import { logStructured } from '../utils/logger';

function isReturningToForeground(
  previousState: AppStateStatus | null,
  nextState: AppStateStatus
): boolean {
  return (
    Boolean(previousState?.match(/inactive|background/)) &&
    nextState === 'active'
  );
}

/**
 * Runtime supervisor React hook.
 *
 * Connects React Native AppState transitions with runtime reconciliation.
 * The main goal is to recover pending_arrival / active session state when
 * the user returns to the app after background/inactive state.
 */
export function useRuntimeSupervisor(): void {
  const previousAppState = useRef<AppStateStatus | null>(AppState.currentState);

  useEffect(() => {
    const subscription = AppState.addEventListener(
      'change',
      (nextAppState: AppStateStatus) => {
        const shouldReconcileForeground = isReturningToForeground(
          previousAppState.current,
          nextAppState
        );

        previousAppState.current = nextAppState;

        if (!shouldReconcileForeground) return;

        logStructured(
          'EVENT',
          'ESTADO_SISTEMA',
          '[FOREGROUND] App returned to foreground. Runtime reconciliation requested.',
          {
            source: 'FOREGROUND',
            appState: nextAppState,
          }
        );

        void reconcileRuntimeState('FOREGROUND');
      }
    );

    return () => {
      subscription.remove();
    };
  }, []);
}

