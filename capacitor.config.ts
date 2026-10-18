import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.structuralengineeringlabs.arpentis',
  appName: 'Arpentis',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
      launchAutoHide: false,
      backgroundColor: '#0f172a',
      androidScaleType: 'CENTER_INSIDE',
      showSpinner: false,
    },
    StatusBar: { style: 'DARK', backgroundColor: '#0f172a' },
  },
};

export default config;
