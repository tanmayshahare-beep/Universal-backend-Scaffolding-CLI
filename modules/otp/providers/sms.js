async function sendSMSOTP(target, code, config) {
  const smsCfg = config.features.otp.sms;
  if (!smsCfg.accountSid || !smsCfg.authToken) {
    throw new Error('Twilio credentials not configured');
  }
  const twilio = require('twilio')(smsCfg.accountSid, smsCfg.authToken);
  await twilio.messages.create({
    body: `Your ${config.project.name} verification code is: ${code}. Expires in ${config.features.otp.expiry || 300}s.`,
    from: smsCfg.from,
    to: target
  });
}

module.exports = { sendSMSOTP };
