describe('LocationFSM policy centralization', () => {
  it('uses REQUIRED_STABLE_GEOFENCE_SAMPLES from runtimePolicy', async () => {
    jest.resetModules();

    jest.doMock('../../runtime/runtimePolicy', () => ({
      RUNTIME_POLICY: {
        REQUIRED_STABLE_GEOFENCE_SAMPLES: 2,
      },
    }));

    const { LocationFSM } = require('../LocationFSM') as typeof import('../LocationFSM');

    const state = new Map<string, string>();
    const storage = {
      getItem: jest.fn(async (key: string) => state.get(key) ?? null),
      setItem: jest.fn(async (key: string, value: string) => {
        state.set(key, value);
      }),
      removeItem: jest.fn(async (key: string) => {
        state.delete(key);
      }),
    };

    const fsm = new LocationFSM(storage);

    await fsm.update('Enter', 'site-1');
    const second = await fsm.update('Enter', 'site-1');

    expect(second.transition).toBe('ENTERED');
  });
});
