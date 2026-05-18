const crypto = require('crypto');
const Webhook = require('./model');
const { dispatch, signPayload } = require('./sender');

async function register(req, res, config) {
  const { url, events, secret, label } = req.body;
  if (!url) return res.status(400).json({ error: 'url required' });

  const hook = await Webhook.create({
    url,
    events: events || ['*'],
    secret: secret || undefined,
    label: label || undefined
  });

  res.status(201).json({ webhook: hook });
}

async function list(req, res) {
  const hooks = await Webhook.find().sort('-createdAt');
  res.json({ webhooks: hooks });
}

async function remove(req, res) {
  await Webhook.findByIdAndDelete(req.params.id);
  res.json({ message: 'Webhook deleted' });
}

async function trigger(req, res, config) {
  const { event, data } = req.body;
  if (!event) return res.status(400).json({ error: 'event required' });

  const results = await dispatch(event, data || {}, config);
  res.json({ triggered: results.length, results });
}

function inbound(req, res, config) {
  const signature = req.headers['x-skeletal-signature'];
  const secret = config.features.webhooks.secret;

  if (secret && signature) {
    const expected = `sha256=${signPayload(req.body, secret)}`;
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
      return res.status(401).json({ error: 'Invalid signature' });
    }
  }

  const io = req.app.get('io');
  if (io) io.emit('webhook:received', { event: req.body.event, data: req.body.data });

  res.json({ received: true });
}

module.exports = { register, list, remove, trigger, inbound };
