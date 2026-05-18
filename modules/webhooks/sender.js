const axios = require('axios');
const crypto = require('crypto');
const Webhook = require('./model');

function signPayload(payload, secret) {
  return crypto.createHmac('sha256', secret).update(JSON.stringify(payload)).digest('hex');
}

async function dispatch(event, data, config) {
  const hooks = await Webhook.find({ active: true, $or: [{ events: event }, { events: '*' }] });
  const webhookSecret = config.features.webhooks.secret;

  const results = await Promise.allSettled(
    hooks.map(hook => sendOne(hook, event, data, webhookSecret))
  );

  return results.map((r, i) => ({
    webhookId: hooks[i]._id,
    url: hooks[i].url,
    success: r.status === 'fulfilled',
    error: r.status === 'rejected' ? r.reason?.message : undefined
  }));
}

async function sendOne(hook, event, data, globalSecret) {
  const payload = { event, data, timestamp: new Date().toISOString() };
  const secret = hook.secret || globalSecret;
  const signature = secret ? signPayload(payload, secret) : undefined;

  const headers = {
    'Content-Type': 'application/json',
    'X-Skeletal-Event': event
  };
  if (signature) headers['X-Skeletal-Signature'] = `sha256=${signature}`;

  try {
    await axios.post(hook.url, payload, { headers, timeout: 5000 });
    hook.lastTriggeredAt = new Date();
    hook.failCount = 0;
    await hook.save();
  } catch (err) {
    hook.failCount = (hook.failCount || 0) + 1;
    if (hook.failCount >= 5) hook.active = false;
    await hook.save();
    throw err;
  }
}

module.exports = { dispatch, signPayload };
