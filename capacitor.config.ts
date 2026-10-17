import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.nutritrack.app',
  appName: 'NutriTrack',
  webDir: 'www',
  plugins: {
    CapacitorHttp: {
      // Patches window.fetch on native platforms → bypasses CORS for all HTTP requests.
      enabled: true,
    },
  },
};

export default config;
