// constants/api.ts

// --- Production URLs ---
// TODO: Replace these with your actual deployed public server URLs
const PROD_API_URL = 'https://your-production-api-server.com/api';
const PROD_WEBSOCKET_URL = 'wss://your-production-websocket-server.com';

// --- Development URLs ---
const DEV_API_URL = 'http://192.168.29.158:9002/api';
const DEV_WEBSOCKET_URL = 'ws://192.168.29.158:8080';

// --- Export the correct URL based on the environment ---
// __DEV__ is a global variable from React Native that is true in development and false in a production build.
export const API_BASE_URL = __DEV__ ? DEV_API_URL : PROD_API_URL;
export const WEBSOCKET_URL = __DEV__ ? DEV_WEBSOCKET_URL : PROD_WEBSOCKET_URL;
