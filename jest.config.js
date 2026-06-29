process.env.TZ = 'America/Los_Angeles';
/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  testEnvironment: 'node',

  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],

  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|react-native-svg))',
  ],

  testPathIgnorePatterns: [
    '/node_modules/',
    '\\.benchmark\\.ts$',
  ],

  clearMocks: true,
};
