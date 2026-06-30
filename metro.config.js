// --- metro.config.js ---
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.watchFolders = [
  __dirname,
];

// Aquí le decimos a Metro que ignore carpetas pesadas que no cambian
config.resolver.blockList = /node_modules\/.*\/node_modules/;

module.exports = config;
