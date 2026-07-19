import { RUNTIME_POLICY } from '../runtime/runtimePolicy';

export enum GeofenceState {
  OUTSIDE = 'OUTSIDE',
  ENTERING = 'ENTERING',
  INSIDE = 'INSIDE',
  EXITING = 'EXITING'
}

export const GEOFENCE_STATE_KEY = 'GEOFENCE_HYSTERESIS_STATE';
export const GEOFENCE_SAMPLES_KEY = 'GEOFENCE_HYSTERESIS_SAMPLES';

const REQUIRED_SAMPLES = RUNTIME_POLICY.REQUIRED_STABLE_GEOFENCE_SAMPLES;

export interface IStorage {
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
    removeItem(key: string): Promise<void>;
}

export class LocationFSM {
  private storage: IStorage;
  private mutex: Promise<void> = Promise.resolve();

  constructor(storage: IStorage) {
    this.storage = storage;
  }

  /**
   * Safe state transition with internal mutex to prevent race conditions
   * when multiple geofence events fire in rapid succession.
   */
  async update(eventType: 'Enter' | 'Exit', siteIdentifier: string): Promise<{ transition: 'ENTERED' | 'EXITED' | 'STAY' }> {
    const release = await this.acquireMutex();
    const stateKey = `${GEOFENCE_STATE_KEY}_${siteIdentifier}`;
    const samplesKey = `${GEOFENCE_SAMPLES_KEY}_${siteIdentifier}`;

    try {
      const currentState = (await this.storage.getItem(stateKey)) as GeofenceState || GeofenceState.OUTSIDE;
      const currentSamples = parseInt((await this.storage.getItem(samplesKey)) || '0', 10);

      let nextState = currentState;
      let nextSamples = currentSamples;
      let transition: 'ENTERED' | 'EXITED' | 'STAY' = 'STAY';

      if (eventType === 'Enter') {
        if (currentState === GeofenceState.OUTSIDE || currentState === GeofenceState.EXITING) {
          nextState = GeofenceState.ENTERING;
          nextSamples = 1;
        } else if (currentState === GeofenceState.ENTERING) {
          nextSamples++;
          if (nextSamples >= REQUIRED_SAMPLES) {
            nextState = GeofenceState.INSIDE;
            nextSamples = 0;
            transition = 'ENTERED';
          }
        }
      } else if (eventType === 'Exit') {
        if (currentState === GeofenceState.INSIDE || currentState === GeofenceState.ENTERING) {
          nextState = GeofenceState.EXITING;
          nextSamples = 1;
        } else if (currentState === GeofenceState.EXITING) {
          nextSamples++;
          if (nextSamples >= REQUIRED_SAMPLES) {
            nextState = GeofenceState.OUTSIDE;
            nextSamples = 0;
            transition = 'EXITED';
          }
        }
      }

      await Promise.all([
        this.storage.setItem(stateKey, nextState),
        this.storage.setItem(samplesKey, nextSamples.toString())
      ]);

      return { transition };
    } finally {
      release();
    }
  }

  async reset(siteIdentifiers?: string[]) {
    const release = await this.acquireMutex();
    try {
      if (siteIdentifiers && siteIdentifiers.length > 0) {
        const cleanup = siteIdentifiers.flatMap(id => [
          this.storage.removeItem(`${GEOFENCE_STATE_KEY}_${id}`),
          this.storage.removeItem(`${GEOFENCE_SAMPLES_KEY}_${id}`)
        ]);
        await Promise.all(cleanup);
      } else {
        // Fallback or legacy cleanup
        await Promise.all([
          this.storage.removeItem(GEOFENCE_STATE_KEY),
          this.storage.removeItem(GEOFENCE_SAMPLES_KEY)
        ]);
      }
    } finally {
      release();
    }
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
