const PushSubscription = require('../models/PushSubscription');
const { getVapidConfig, sendPushNotification } = require('../services/pushNotifications');

function isValidPushEndpoint(value) {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function getPublicKey(req, res) {
  const config = getVapidConfig();
  if (!config) {
    return res.status(503).json({ message: 'Push notifications are not configured on this server.' });
  }
  res.json({ publicKey: config.publicKey });
}

async function saveSubscription(req, res, next) {
  try {
    const { endpoint, keys } = req.body || {};
    if (
      typeof endpoint !== 'string'
      || endpoint.length > 2048
      || !isValidPushEndpoint(endpoint)
      || typeof keys?.p256dh !== 'string'
      || !keys.p256dh
      || keys.p256dh.length > 256
      || typeof keys?.auth !== 'string'
      || !keys.auth
      || keys.auth.length > 256
    ) {
      return res.status(400).json({ message: 'A valid push subscription is required.' });
    }
    await PushSubscription.findOneAndUpdate(
      { endpoint },
      { owner: req.user.id, endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    );
    res.status(201).json({ message: 'Push notifications enabled for this device.' });
  } catch (error) {
    next(error);
  }
}

async function deleteSubscription(req, res, next) {
  try {
    const { endpoint } = req.body || {};
    if (typeof endpoint !== 'string' || endpoint.length > 2048) {
      return res.status(400).json({ message: 'A valid push subscription endpoint is required.' });
    }
    await PushSubscription.deleteOne({ owner: req.user.id, endpoint });
    res.json({ message: 'Push notifications disabled for this device.' });
  } catch (error) {
    next(error);
  }
}

async function sendTestNotification(req, res, next) {
  try {
    const result = await sendPushNotification(req.workspaceOwnerId, {
      title: 'GBN Supply Chain test',
      message: 'Push notifications are reaching this device.',
      url: '/'
    });
    if (!result.deviceCount) {
      return res.status(404).json({
        message: 'This account has no saved push subscriptions. Enable notifications on this device first.'
      });
    }
    if (!result.delivered) {
      const status = result.firstFailureStatus ? ` (push service HTTP ${result.firstFailureStatus})` : '';
      return res.status(502).json({
        message: `The push service could not deliver to any subscribed device${status}. Re-enable notifications on this device and try again.`
      });
    }
    res.json({
      message: `Test push sent to ${result.delivered} device${result.delivered === 1 ? '' : 's'}.`,
      delivered: result.delivered,
      failed: result.failed
    });
  } catch (error) {
    if (error.code === 'PUSH_NOT_CONFIGURED') {
      return res.status(503).json({ message: error.message });
    }
    next(error);
  }
}

module.exports = { getPublicKey, saveSubscription, deleteSubscription, sendTestNotification };
