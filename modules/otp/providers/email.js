const nodemailer = require('nodemailer');

async function sendEmailOTP(target, code, config) {
  const emailCfg = config.features.otp.email;

  const isGmail = emailCfg.provider === 'gmail' ||
    (emailCfg.host || '').toLowerCase().includes('gmail.com');

  const transportConfig = isGmail
    ? { service: 'gmail', auth: { user: emailCfg.user, pass: emailCfg.pass } }
    : {
        host: emailCfg.host,
        port: emailCfg.port || 587,
        secure: emailCfg.port === 465,
        auth: { user: emailCfg.user, pass: emailCfg.pass }
      };

  const transporter = nodemailer.createTransport(transportConfig);

  await transporter.sendMail({
    from: `"${config.project.name}" <${emailCfg.user}>`,
    to: target,
    subject: `Your verification code`,
    html: `
      <div style="font-family:sans-serif;max-width:400px;margin:auto">
        <h2>${config.project.name}</h2>
        <p>Your verification code is:</p>
        <h1 style="letter-spacing:8px;color:#333">${code}</h1>
        <p style="color:#888;font-size:12px">Expires in ${config.features.otp.expiry || 300} seconds. Do not share this code.</p>
      </div>
    `
  });
}

module.exports = { sendEmailOTP };
