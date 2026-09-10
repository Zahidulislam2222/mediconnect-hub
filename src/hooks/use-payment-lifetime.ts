import { useLayoutEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Hub } from 'aws-amplify/utils';

/** Cancel payment work on requester removal, navigation, or identity invalidation. */
export function usePaymentLifetime() {
  const { key } = useLocation();
  const lifetime = useRef(new AbortController());
  useLayoutEffect(() => {
    const controller = new AbortController();
    lifetime.current = controller;
    const unsubscribe = Hub.listen('auth', ({ payload }) => {
      if (payload.event === 'signedOut' || payload.event === 'tokenRefresh_failure') {
        controller.abort();
      }
    });
    return () => {
      controller.abort();
      unsubscribe();
    };
  }, [key]);
  return lifetime;
}
