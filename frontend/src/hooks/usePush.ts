import { useState, useEffect } from 'react';
import { pushApi } from '../services/api';

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export type PushState = 'unsupported' | 'denied' | 'subscribed' | 'unsubscribed' | 'loading';

export function usePush() {
  const [state, setState] = useState<PushState>('loading');

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setState('unsupported');
      return;
    }
    navigator.serviceWorker.register('/sw.js').then(async (reg) => {
      const existing = await reg.pushManager.getSubscription();
      if (existing) { setState('subscribed'); return; }
      const perm = Notification.permission;
      if (perm === 'denied') setState('denied');
      else setState('unsubscribed');
    });
  }, []);

  const subscribe = async () => {
    setState('loading');
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          import.meta.env.VITE_VAPID_PUBLIC_KEY as string
        ),
      });
      await pushApi.subscribe(sub.toJSON());
      setState('subscribed');
    } catch {
      const perm = Notification.permission;
      setState(perm === 'denied' ? 'denied' : 'unsubscribed');
    }
  };

  return { state, subscribe };
}
