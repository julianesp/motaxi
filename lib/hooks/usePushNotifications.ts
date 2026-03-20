'use client';

import { useState, useEffect, useCallback } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787';

function getAuthToken(): string | null {
  const cookies = document.cookie.split(';');
  const authCookie = cookies.find(c => c.trim().startsWith('authToken='));
  return authCookie ? authCookie.split('=')[1]?.trim() : null;
}

function urlBase64ToArrayBuffer(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const arr = new Uint8Array([...rawData].map(c => c.charCodeAt(0)));
  return arr.buffer as ArrayBuffer;
}

export function usePushNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Verificar estado inicial
  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    setPermission(Notification.permission);
    checkSubscriptionStatus();
  }, []);

  const checkSubscriptionStatus = useCallback(async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    try {
      const reg = await navigator.serviceWorker.getRegistration('/sw.js');
      if (!reg) return;
      const sub = await reg.pushManager.getSubscription();
      setIsSubscribed(!!sub);
    } catch {}
  }, []);

  const subscribe = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        setError('Tu navegador no soporta notificaciones push.');
        return false;
      }

      // Pedir permiso
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') {
        setError('Permiso de notificaciones denegado.');
        return false;
      }

      // Registrar service worker
      const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      await navigator.serviceWorker.ready;

      // Obtener clave pública VAPID
      const token = getAuthToken();
      const vapidRes = await fetch(`${API_URL}/notifications/vapid-public-key`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!vapidRes.ok) throw new Error('No se pudo obtener la clave VAPID');
      const { publicKey } = await vapidRes.json() as { publicKey: string };

      // Suscribirse al PushManager
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToArrayBuffer(publicKey),
      });

      const subJson = subscription.toJSON();
      const p256dh = (subJson.keys as any)?.p256dh;
      const auth = (subJson.keys as any)?.auth;

      // Enviar suscripción al backend
      const res = await fetch(`${API_URL}/notifications/push-subscription`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ endpoint: subscription.endpoint, p256dh, auth }),
      });

      if (!res.ok) throw new Error('Error al guardar la suscripción');

      setIsSubscribed(true);
      return true;
    } catch (err: any) {
      setError(err.message || 'Error al activar notificaciones');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const unsubscribe = useCallback(async (): Promise<void> => {
    try {
      const reg = await navigator.serviceWorker.getRegistration('/sw.js');
      if (!reg) return;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        const token = getAuthToken();
        await fetch(`${API_URL}/notifications/push-subscription`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setIsSubscribed(false);
    } catch {}
  }, []);

  const isSupported = typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window;

  return { permission, isSubscribed, isLoading, error, isSupported, subscribe, unsubscribe };
}
