import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mediconnect.app',
  appName: 'MediConnect',
  webDir: 'dist',

  server: {
    androidScheme: 'https'
  },
  plugins: {
    PushNotifications: {
      presentationOptions:["badge", "sound", "alert"],
    },
  },
};

export default config;