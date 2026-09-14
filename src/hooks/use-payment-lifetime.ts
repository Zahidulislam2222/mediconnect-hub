import { useLayoutEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Hub } from 'aws-amplify/utils';
import { SESSION_CLEARED_EVENT } from '@/lib/secure-storage';

/** Cancel payment work on requester removal, navigation, or identity invalidation. */
export function usePaymentLifetime() {
  const { key } = useLocation();
  const lifetime = useRef(new AbortController());
  useLayoutEffect(() => {
    const controller = new AbortController();
    lifetime.current = controller;
    const invalidate = () => controller.abort();
    window.addEventListener(SESSION_CLEARED_EVENT, invalidate);
    const unsubscribe = Hub.listen('auth', ({ payload }) => {
      if (payload.event === 'signedOut' || payload.event === 'tokenRefresh_failure' || payload.event === 'signedIn') {
        controller.abort();
      }
    });
    return () => {
      controller.abort();
      unsubscribe();
      window.removeEventListener(SESSION_CLEARED_EVENT, invalidate);
    };
  }, [key]);
  return lifetime;
}
