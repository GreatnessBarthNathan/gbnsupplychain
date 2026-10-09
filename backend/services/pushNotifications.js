const webPush = require('web-push');
const PushSubscription = require('../models/PushSubscription');
const User = require('../models/User');

let configured = false;

function getVapidConfig() {
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !VAPID_SUBJECT) return null;
  return { publicKey: VAPID_PUBLIC_KEY, privateKey: VAPID_PRIVATE_KEY, subject: VAPID_SUBJECT };
}

function configureWebPush() {
  const config = getVapidConfig();
  if (!config) {
    const error = new Error('Push notifications are not configured on this server.');
    error.code = 'PUSH_NOT_CONFIGURED';
    throw error;
  }
  if (!configured) {
    webPush.setVapidDetails(config.subject, config.publicKey, config.privateKey);
    configured = true;
  }
  return config;
}

async function sendPushNotification(workspaceOwnerId, notification) {
  configureWebPush();
  const users = await User.find({
    isActive: true,
    $or: [
      { _id: workspaceOwnerId },
      { invitedBy: workspaceOwnerId, role: 'staff' }
    ]
  }).select('_id').lean();
  const subscriptions = await PushSubscription.find({
    owner: { $in: users.map((user) => user._id) }
  }).lean();
  const payload = JSON.stringify({
    title: notification.title || 'GBN Supply Chain',
    body: notification.message,
    url: notification.url || '/orders'
  });
  const results = await Promise.all(subscriptions.map(async (subscription) => {
    try {
      await webPush.sendNotification(
        { endpoint: subscription.endpoint, keys: subscription.keys },
        payload
      );
      return { delivered: true };
    } catch (error) {
      if (error.statusCode === 404 || error.statusCode === 410) {
        await PushSubscription.deleteOne({ _id: subscription._id });
      }
      console.error('Push notification delivery failed:', error.statusCode || 'unknown provider error');
      return { delivered: false, statusCode: error.statusCode };
    }
  }));

  return {
    deviceCount: subscriptions.length,
    delivered: results.filter((result) => result.delivered).length,
    failed: results.filter((result) => !result.delivered).length,
    firstFailureStatus: results.find((result) => !result.delivered)?.statusCode
  };
}

module.exports = { getVapidConfig, sendPushNotification };
