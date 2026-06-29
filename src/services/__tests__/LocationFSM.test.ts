import { LocationFSM, GeofenceState, GEOFENCE_STATE_KEY } from '../LocationFSM';

describe('LocationFSM Hysteresis', () => {
  let mockStorage: Record<string, string>;
  let fsm: LocationFSM;
  const SITE_ID = 'SITE_TEST';

  beforeEach(() => {
    mockStorage = {};
    const storage = {
      getItem: async (key: string) => mockStorage[key] || null,
      setItem: async (key: string, value: string) => { mockStorage[key] = value; },
      removeItem: async (key: string) => { delete mockStorage[key]; }
    };
    fsm = new LocationFSM(storage);
  });

  it('should require 3 samples to transition from OUTSIDE to INSIDE with site identifier', async () => {
    const stateKey = `${GEOFENCE_STATE_KEY}_${SITE_ID}`;
    // 1st sample
    let result = await fsm.update('Enter', SITE_ID);
    expect(result.transition).toBe('STAY');
    expect(mockStorage[stateKey]).toBe(GeofenceState.ENTERING);

    // 2nd sample
    result = await fsm.update('Enter', SITE_ID);
    expect(result.transition).toBe('STAY');

    // 3rd sample
    result = await fsm.update('Enter', SITE_ID);
    expect(result.transition).toBe('ENTERED');
    expect(mockStorage[stateKey]).toBe(GeofenceState.INSIDE);
  });

  it('should isolate states between different sites', async () => {
    const SITE_A = 'SITE_A';
    const SITE_B = 'SITE_B';
    const stateKeyA = `${GEOFENCE_STATE_KEY}_${SITE_A}`;
    const stateKeyB = `${GEOFENCE_STATE_KEY}_${SITE_B}`;

    await fsm.update('Enter', SITE_A);
    expect(mockStorage[stateKeyA]).toBe(GeofenceState.ENTERING);
    expect(mockStorage[stateKeyB]).toBeUndefined();

    await fsm.update('Enter', SITE_B);
    expect(mockStorage[stateKeyB]).toBe(GeofenceState.ENTERING);
  });

  it('should require 3 samples to transition from INSIDE to OUTSIDE', async () => {
    const stateKey = `${GEOFENCE_STATE_KEY}_${SITE_ID}`;
    // Setup INSIDE state
    await fsm.update('Enter', SITE_ID);
    await fsm.update('Enter', SITE_ID);
    await fsm.update('Enter', SITE_ID);

    // 1st sample EXIT
    let result = await fsm.update('Exit', SITE_ID);
    expect(result.transition).toBe('STAY');
    expect(mockStorage[stateKey]).toBe(GeofenceState.EXITING);

    // 2nd sample EXIT
    result = await fsm.update('Exit', SITE_ID);
    expect(result.transition).toBe('STAY');

    // 3rd sample EXIT
    result = await fsm.update('Exit', SITE_ID);
    expect(result.transition).toBe('EXITED');
    expect(mockStorage[stateKey]).toBe(GeofenceState.OUTSIDE);
  });

  it('should reset specific site samples', async () => {
    const stateKey = `${GEOFENCE_STATE_KEY}_${SITE_ID}`;
    await fsm.update('Enter', SITE_ID);
    expect(mockStorage[stateKey]).toBeDefined();

    await fsm.reset([SITE_ID]);
    expect(mockStorage[stateKey]).toBeUndefined();
  });
});
