const nodemailer = require('nodemailer');

async function sendEmail({ to, subject, html, text, config }) {
  const emailCfg = config?.features?.otp?.email?.enabled
    ? config.features.otp.email
    : config?.features?.email;

  if (!emailCfg || !emailCfg.user || !emailCfg.pass) {
    throw new Error('Email not configured');
  }

  let transportOpts;
  if (emailCfg.provider === 'gmail') {
    transportOpts = {
      service: 'gmail',
      auth: { user: emailCfg.user, pass: emailCfg.pass }
    };
  } else {
    transportOpts = {
      host: emailCfg.host,
      port: emailCfg.port || 587,
      secure: (emailCfg.port || 587) === 465,
      auth: { user: emailCfg.user, pass: emailCfg.pass }
    };
  }

  const transporter = nodemailer.createTransport(transportOpts);
  await transporter.sendMail({
    from: emailCfg.user,
    to,
    subject,
    html,
    text
  });
}

module.exports = { sendEmail };
