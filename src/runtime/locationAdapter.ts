import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { log } from '../utils/logger';

export interface LocationCoordinates {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
}

export const locationAdapter = {
  requestPermissions: async () => {
    const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
    if (fgStatus !== 'granted') return false;
    const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
    return bgStatus === 'granted';
  },

  getCurrentLocation: async (): Promise<LocationCoordinates | null> => {
    try {
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      return {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
      };
    } catch (e) {
      log('ROJO', 'ERROR_CRITICO', 'ERROR', 'Error getting current location', e);
      return null;
    }
  },

  geocodeAddress: async (address: string): Promise<LocationCoordinates | null> => {
    try {
      const results = await Location.geocodeAsync(address);
      if (results.length > 0) {
        return {
          latitude: results[0].latitude,
          longitude: results[0].longitude,
        };
      }
      return null;
    } catch (e) {
      log('ROJO', 'ERROR_CRITICO', 'ERROR', 'Error geocoding address', e);
      return null;
    }
  },

  startGeofencing: async (taskName: string, regions: Location.LocationRegion[]) => {
    return await Location.startGeofencingAsync(taskName, regions);
  },

  stopGeofencing: async (taskName: string) => {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(taskName);
    if (isRegistered) {
      await Location.stopGeofencingAsync(taskName);
    }
  },

  isTaskRegistered: async (taskName: string) => {
    return await TaskManager.isTaskRegisteredAsync(taskName);
  }
};
