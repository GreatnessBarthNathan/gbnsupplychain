import { api } from './api';

function decodeApplicationServerKey(value) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}

export async function enablePushNotifications() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    throw new Error('This browser does not support push notifications.');
  }
  if (Notification.permission === 'denied') {
    throw new Error('Notifications are blocked for this site. Allow them in your browser settings, then try again.');
  }

  const permissionRequest = Notification.permission === 'default'
    ? Notification.requestPermission()
    : Promise.resolve(Notification.permission);
  if (await permissionRequest !== 'granted') {
    throw new Error('Allow notifications in your browser to receive device alerts.');
  }

  const { publicKey } = await api('/push/public-key');
  const registration = await navigator.serviceWorker.register('/service-worker.js');
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: decodeApplicationServerKey(publicKey)
    });
  }
  await api('/push/subscriptions', {
    method: 'POST',
    body: JSON.stringify(subscription)
  });
  return subscription;
}

export async function disablePushNotifications() {
  if (!('serviceWorker' in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;
  await api('/push/subscriptions', {
    method: 'DELETE',
    body: JSON.stringify({ endpoint: subscription.endpoint })
  });
  await subscription.unsubscribe();
}
