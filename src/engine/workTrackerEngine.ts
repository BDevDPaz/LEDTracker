import { EngineState, EngineEvent } from './contracts/types';
import { workTrackerReducer } from './reducer/workTrackerReducer';
import { workTrackerEffects } from './effects/workTrackerEffects';
import { initialState } from './state/initialState';
import { log } from '../utils/logger';
import { setLocationEngineEventDispatcher } from '../services/LocationManager';

type Listener = (state: EngineState) => void;

class WorkTrackerEngine {
  private state: EngineState = initialState;
  private listeners: Set<Listener> = new Set();
  private mutex: Promise<void> = Promise.resolve();

  getState() {
    return this.state;
  }

  /**
   * Safe dispatch with internal mutex to ensure sequential processing
   * and prevent race conditions between rapid background/foreground events.
   */
  async dispatch(event: EngineEvent) {
    const release = await this.acquireMutex();

    try {
      log('BLANCO', 'ESTADO_SISTEMA', 'DEBUG', `Engine Dispatch: ${event.type}`);
      this.state = workTrackerReducer(this.state, event);
      this.notify();
    } catch (err) {
      log('ROJO', 'ERROR_CRITICO', 'ERROR', 'Critical error in engine reducer', err);

      // Release the mutex BEFORE running effects to avoid deadlocks
      // when effects dispatch new events.
      release();
      return;
    }

    // Release the mutex BEFORE running effects to avoid deadlocks
    // when effects dispatch new events.
    release();

    try {
      // Effects run outside the state transition mutex
      await workTrackerEffects(event, this.state, this.dispatch.bind(this));
    } catch (err) {
      log('ROJO', 'ERROR_CRITICO', 'ERROR', 'Critical error in engine effects', err);
    }
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((listener) => listener(this.state));
  }

  private async acquireMutex(): Promise<() => void> {
    let release: () => void;

    const nextMutex = new Promise<void>((resolve) => {
      release = resolve;
    });

    const currentMutex = this.mutex;
    this.mutex = nextMutex;

    await currentMutex;

    return release!;
  }
}

export const engine = new WorkTrackerEngine();

setLocationEngineEventDispatcher((event) => {
  void engine.dispatch(event);
});

