import * as Location from 'expo-location';
// import { log } from '../utils/logger';

export const securityAdapter = {
  checkLocationPermissions: async () => {
    const { status: fg } = await Location.getForegroundPermissionsAsync();
    const { status: bg } = await Location.getBackgroundPermissionsAsync();
    return {
      foreground: fg === 'granted',
      background: bg === 'granted'
    };
  },

  sanitizeInput: (text: string): string => {
    // Basic sanitization
    return text.replace(/[<>]/g, '').trim();
  }
};
