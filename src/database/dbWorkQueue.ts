import { logStructured } from '../utils/logger';

let dbWorkQueue: Promise<void> = Promise.resolve();

export type DbWorkSource =
  | 'app-init'
  | 'ui-load-stats'
  | 'dashboard-refresh'
  | 'bg-database-work'
  | 'report-generation'
  | 'report-delivery'
  | 'runtime-reconciliation'
  | 'manual-checkout'
  | 'unknown';

export async function runDatabaseWork<T>(
  source: DbWorkSource,
  work: () => Promise<T>
): Promise<T> {
  let release!: () => void;

  const previousWork = dbWorkQueue;

  dbWorkQueue = new Promise<void>((resolve) => {
    release = resolve;
  });

  await previousWork;

  logStructured('DEBUG', 'ESTADO_SISTEMA', `MUTEX_LOCK: ${source}`, {
    source,
  });

  try {
    return await work();
  } finally {
    logStructured('DEBUG', 'ESTADO_SISTEMA', `MUTEX_UNLOCK: ${source}`, {
      source,
    });

    release();
  }
}

