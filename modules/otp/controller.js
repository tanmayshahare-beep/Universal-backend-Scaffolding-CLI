const crypto = require('crypto');
const OTP = require('./model');
const { sendEmailOTP } = require('./providers/email');
const { sendSMSOTP } = require('./providers/sms');

function generateCode(length) {
  return String(crypto.randomInt(0, Math.pow(10, length))).padStart(length, '0');
}

async function send(req, res, config) {
  const { target, type, purpose } = req.body;
  if (!target || !type) return res.status(400).json({ error: 'target and type (email|sms) required' });
  if (!['email', 'sms'].includes(type)) return res.status(400).json({ error: 'type must be email or sms' });

  const otpCfg = config.features.otp;
  if (type === 'sms' && !otpCfg.sms?.enabled) return res.status(400).json({ error: 'SMS OTP not enabled' });
  if (type === 'email' && !otpCfg.email?.enabled) return res.status(400).json({ error: 'Email OTP not enabled' });

  await OTP.deleteMany({ target, type, purpose: purpose || 'verify', used: false });

  const code = generateCode(otpCfg.length || 6);
  const expiresAt = new Date(Date.now() + (otpCfg.expiry || 300) * 1000);

  await OTP.create({ target, type, code, purpose: purpose || 'verify', expiresAt });

  if (type === 'email') {
    await sendEmailOTP(target, code, config);
  } else {
    await sendSMSOTP(target, code, config);
  }

  res.json({ message: `OTP sent to ${type}`, expiresIn: otpCfg.expiry || 300 });
}

async function verify(req, res) {
  const { target, code, type, purpose } = req.body;
  if (!target || !code || !type) return res.status(400).json({ error: 'target, code, and type required' });

  const record = await OTP.findOne({
    target,
    type,
    code,
    purpose: purpose || 'verify',
    used: false,
    expiresAt: { $gt: new Date() }
  });

  if (!record) return res.status(400).json({ error: 'Invalid or expired OTP', verified: false });

  record.used = true;
  await record.save();

  res.json({ message: 'OTP verified', verified: true });
}

module.exports = { send, verify };
