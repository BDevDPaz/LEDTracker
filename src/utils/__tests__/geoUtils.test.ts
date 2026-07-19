// --- src/utils/__tests__/geoUtils.test.ts ---
import { getDistanceFromLatLonInMeters } from '../geoUtils';

describe('geoUtils - Cálculo de Distancia', () => {

  it('debería devolver 0 si las coordenadas son idénticas', () => {
    const lat = 34.0522;
    const lon = -118.2437;
    const dist = getDistanceFromLatLonInMeters(lat, lon, lat, lon);
    expect(dist).toBe(0);
  });

  it('debería calcular la distancia correcta entre dos puntos conocidos', () => {
    // Punto A: Staples Center, LA (34.0430, -118.2673)
    // Punto B: LA Convention Center (34.0403, -118.2696)
    const dist = getDistanceFromLatLonInMeters(
      34.0430, -118.2673, // A
      34.0403, -118.2696  // B
    );

    expect(dist).toBeGreaterThan(350);
    expect(dist).toBeLessThan(370);
  });

  it('debería manejar distancias largas correctamente', () => {
    const la = { lat: 34.0522, lon: -118.2437 };
    const ny = { lat: 40.7128, lon: -74.0060 };

    const dist = getDistanceFromLatLonInMeters(la.lat, la.lon, ny.lat, ny.lon);

    expect(dist).toBeGreaterThan(3900000);
    expect(dist).toBeLessThan(4000000);
  });

  it('debería aceptar coordenadas 0 como valores válidos', () => {
    const dist = getDistanceFromLatLonInMeters(
      0,
      -118.2437,
      34.0522,
      -118.2437
    );
  
    expect(dist).toBeGreaterThan(0);
  });
  
  it('debería devolver 0 si alguna coordenada no es finita', () => {
    const dist = getDistanceFromLatLonInMeters(
      Number.NaN,
      -118.2437,
      34.0522,
      -118.2437
    );

    expect(dist).toBe(0);
  });
});

