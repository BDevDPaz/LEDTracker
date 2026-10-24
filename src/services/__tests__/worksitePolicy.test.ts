import {
  GEOFENCE_ENTRY_RADIUS_M,
  WORKSITE_EXIT_DISTANCE_M,
  advanceExitCounter,
  classifyDistance,
  isAcceptableAccuracy,
} from '../worksitePolicy';

describe('worksitePolicy thresholds (README)', () => {
  it('usa 150 m de entrada y 3.2 km de salida por defecto', () => {
    expect(GEOFENCE_ENTRY_RADIUS_M).toBe(150);
    expect(WORKSITE_EXIT_DISTANCE_M).toBe(3200);
  });

  it('clasifica distancias en los bordes', () => {
    expect(classifyDistance(0)).toBe('INSIDE_ENTRY');
    expect(classifyDistance(150)).toBe('INSIDE_ENTRY');
    expect(classifyDistance(150.1)).toBe('NEAR_SITE');
    expect(classifyDistance(3200)).toBe('NEAR_SITE');
    expect(classifyDistance(3200.1)).toBe('BEYOND_EXIT');
  });

  it('respeta radios configurables', () => {
    expect(classifyDistance(250, 300, 1000)).toBe('INSIDE_ENTRY');
    expect(classifyDistance(1001, 300, 1000)).toBe('BEYOND_EXIT');
  });

  it('rechaza precisión null/0/NaN o peor que el umbral', () => {
    expect(isAcceptableAccuracy(null)).toBe(false);
    expect(isAcceptableAccuracy(undefined)).toBe(false);
    expect(isAcceptableAccuracy(0)).toBe(false);
    expect(isAcceptableAccuracy(Number.NaN)).toBe(false);
    expect(isAcceptableAccuracy(51)).toBe(false);
    expect(isAcceptableAccuracy(50)).toBe(true);
    expect(isAcceptableAccuracy(12)).toBe(true);
  });

  it('confirma salida solo tras 3 lecturas consecutivas fuera y reinicia al volver', () => {
    let state = { consecutiveBeyond: 0 };
    let r = advanceExitCounter(state, 'BEYOND_EXIT'); state = r.state;
    expect(r.exitConfirmed).toBe(false);
    r = advanceExitCounter(state, 'BEYOND_EXIT'); state = r.state;
    expect(r.exitConfirmed).toBe(false);
    r = advanceExitCounter(state, 'NEAR_SITE'); state = r.state;
    expect(state.consecutiveBeyond).toBe(0);
    for (let i = 0; i < 2; i++) { r = advanceExitCounter(state, 'BEYOND_EXIT'); state = r.state; }
    expect(r.exitConfirmed).toBe(false);
    r = advanceExitCounter(state, 'BEYOND_EXIT');
    expect(r.exitConfirmed).toBe(true);
  });
});
