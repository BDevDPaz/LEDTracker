import { logStructured } from '../utils/logger';

export type RuntimeReconcileSource =
  | 'APP_INIT'
  | 'FOREGROUND'
  | 'DASHBOARD_REFRESH'
  | 'BACKGROUND_TASK';

let isReconciling = false;

/**
 * Orchestrates the runtime state reconciliation process.
 * Safeguarded against reentrancy and runtime failures.
 */
export async function reconcileRuntimeState(source: RuntimeReconcileSource): Promise<void> {
  if (isReconciling) {
    logStructured(
      'INFO',
      'SIN_CAMBIOS',
      `[${source}] Runtime reconciliation skipped: already in progress.`,
      { source, reason: 'ALREADY_IN_PROGRESS' }
    );
    return;
  }

  isReconciling = true;

  try {
    logStructured(
      'EVENT',
      'ESTADO_SISTEMA',
      `[${source}] RUNTIME_RECONCILE_STARTED`,
      { source }
    );

    // Initial coordination logic (to be expanded in subsequent tasks)
    // Tarea 4: Reconciliar pending_arrival
    // Tarea 8-9: Reconciliar active y failsafe checkout

    logStructured(
      'INFO',
      'OPERACION_EXITOSA',
      `[${source}] RUNTIME_RECONCILE_COMPLETED`,
      { source }
    );
  } catch (error) {
    logStructured(
      'ERROR',
      'ERROR_CRITICO',
      `[${source}] RUNTIME_RECONCILE_FAILED`,
      { source, error: error instanceof Error ? error.message : String(error) }
    );
  } finally {
    isReconciling = false;
  }
}

/**
 * Semantic wrappers for different entry points
 */
export async function onAppStart(): Promise<void> {
  return reconcileRuntimeState('APP_INIT');
}

export async function onAppForeground(): Promise<void> {
  return reconcileRuntimeState('FOREGROUND');
}

export async function onDashboardRefresh(): Promise<void> {
  return reconcileRuntimeState('DASHBOARD_REFRESH');
}

export async function onBackgroundMaintenance(): Promise<void> {
  return reconcileRuntimeState('BACKGROUND_TASK');
}

