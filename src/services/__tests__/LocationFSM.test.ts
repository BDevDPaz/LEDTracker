import { LocationFSM, GeofenceState, GEOFENCE_STATE_KEY } from '../LocationFSM';

describe('LocationFSM Hysteresis', () => {
  let mockStorage: Record<string, string>;
  let fsm: LocationFSM;

  beforeEach(() => {
    mockStorage = {};
    const storage = {
      getItem: async (key: string) => mockStorage[key] || null,
      setItem: async (key: string, value: string) => { mockStorage[key] = value; },
      removeItem: async (key: string) => { delete mockStorage[key]; }
    };
    fsm = new LocationFSM(storage);
  });

  it('should require 3 samples to transition from OUTSIDE to INSIDE', async () => {
    // 1st sample
    let result = await fsm.update('Enter');
    expect(result.transition).toBe('STAY');
    expect(mockStorage[GEOFENCE_STATE_KEY]).toBe(GeofenceState.ENTERING);

    // 2nd sample
    result = await fsm.update('Enter');
    expect(result.transition).toBe('STAY');

    // 3rd sample
    result = await fsm.update('Enter');
    expect(result.transition).toBe('ENTERED');
    expect(mockStorage[GEOFENCE_STATE_KEY]).toBe(GeofenceState.INSIDE);
  });

  it('should require 3 samples to transition from INSIDE to OUTSIDE', async () => {
    // Setup INSIDE state
    await fsm.update('Enter');
    await fsm.update('Enter');
    await fsm.update('Enter');

    // 1st sample EXIT
    let result = await fsm.update('Exit');
    expect(result.transition).toBe('STAY');
    expect(mockStorage[GEOFENCE_STATE_KEY]).toBe(GeofenceState.EXITING);

    // 2nd sample EXIT
    result = await fsm.update('Exit');
    expect(result.transition).toBe('STAY');

    // 3rd sample EXIT
    result = await fsm.update('Exit');
    expect(result.transition).toBe('EXITED');
    expect(mockStorage[GEOFENCE_STATE_KEY]).toBe(GeofenceState.OUTSIDE);
  });

  it('should reset samples if noise is detected', async () => {
    await fsm.update('Enter'); // ENTERING(1)

    // Noise: Exit signal while in ENTERING state
    let result = await fsm.update('Exit');
    expect(result.transition).toBe('STAY');
    expect(mockStorage[GEOFENCE_STATE_KEY]).toBe(GeofenceState.EXITING);
  });
});
