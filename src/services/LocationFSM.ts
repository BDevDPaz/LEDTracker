export enum GeofenceState {
  OUTSIDE = 'OUTSIDE',
  ENTERING = 'ENTERING',
  INSIDE = 'INSIDE',
  EXITING = 'EXITING'
}

export const GEOFENCE_STATE_KEY = 'GEOFENCE_HYSTERESIS_STATE';
export const GEOFENCE_SAMPLES_KEY = 'GEOFENCE_HYSTERESIS_SAMPLES';

const REQUIRED_SAMPLES = 3;

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
  async update(eventType: 'Enter' | 'Exit'): Promise<{ transition: 'ENTERED' | 'EXITED' | 'STAY' }> {
    const release = await this.acquireMutex();
    try {
      const currentState = (await this.storage.getItem(GEOFENCE_STATE_KEY)) as GeofenceState || GeofenceState.OUTSIDE;
      const currentSamples = parseInt((await this.storage.getItem(GEOFENCE_SAMPLES_KEY)) || '0', 10);

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
        this.storage.setItem(GEOFENCE_STATE_KEY, nextState),
        this.storage.setItem(GEOFENCE_SAMPLES_KEY, nextSamples.toString())
      ]);

      return { transition };
    } finally {
      release();
    }
  }

  async reset() {
    const release = await this.acquireMutex();
    try {
      await Promise.all([
        this.storage.removeItem(GEOFENCE_STATE_KEY),
        this.storage.removeItem(GEOFENCE_SAMPLES_KEY)
      ]);
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
