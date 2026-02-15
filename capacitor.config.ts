import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mediconnect.app',
  appName: 'MediConnect',
  webDir: 'dist',
  // 🟢 ADD THIS BLOCK:
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
};

export default config;