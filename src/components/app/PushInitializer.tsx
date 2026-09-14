import { useEffect } from 'react';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { api } from '@/lib/api';
import { getUser, SESSION_CLEARED_EVENT } from '@/lib/secure-storage';
import { pushRouting } from '@/config/env';

export function PushInitializer({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!enabled || !Capacitor.isNativePlatform()) return;
    const controller = new AbortController();
    const handles: PluginListenerHandle[] = [];
    const remove = (handle: PluginListenerHandle) => { void handle.remove().catch(() => {}); };
    const close = () => {
      controller.abort();
      for (const handle of handles.splice(0)) remove(handle);
      window.removeEventListener(SESSION_CLEARED_EVENT, close);
    };
    window.addEventListener(SESSION_CLEARED_EVENT, close);
    const own = async (pending: Promise<PluginListenerHandle>) => {
      const handle = await pending;
      if (controller.signal.aborted) { remove(handle); return false; }
      handles.push(handle);
      return true;
    };
    const setup = async () => {
      let permission = await PushNotifications.checkPermissions();
      if (controller.signal.aborted) return;
      if (permission.receive === 'prompt') {
        permission = await PushNotifications.requestPermissions();
        if (controller.signal.aborted) return;
      }
      if (permission.receive !== 'granted') return;
      if (!await own(PushNotifications.addListener('registration', async token => {
        if (controller.signal.aborted) return;
        const user = getUser();
        if (!user || typeof user.id !== 'string' || !user.id || !token.value
          || (user.role !== 'patient' && user.role !== 'doctor')) return;
        const endpoint = `${pushRouting[user.role]}/${encodeURIComponent(user.id)}`;
        try { await api.put(endpoint, { fcmToken: token.value }, { signal: controller.signal }); }
        catch { /* No token or provider error is written to logs. */ }
      }))) return;
      if (!await own(PushNotifications.addListener('pushNotificationActionPerformed', () => {
        // Notification destination handling is outside this registration boundary.
      }))) return;
      if (!controller.signal.aborted) await PushNotifications.register();
    };
    void setup().catch(close);
    return close;
  }, [enabled]);
  return null;
}
