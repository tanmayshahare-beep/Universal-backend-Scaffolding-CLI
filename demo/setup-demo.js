const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const inquirer = require('inquirer');

const configPath = path.resolve(__dirname, '..', 'skeletal.config.json');

async function main() {
  if (fs.existsSync(configPath)) {
    const { overwrite } = await inquirer.prompt([{
      type: 'confirm',
      name: 'overwrite',
      message: 'skeletal.config.json already exists. Overwrite it with demo config?',
      default: false
    }]);
    if (!overwrite) {
      console.log('\n  Keeping existing config. Run: npm start\n');
      return;
    }
  }

  // ── Gmail setup ──────────────────────────────────────────────────────────
  console.log('\n  OTP Email (optional — skip to disable)\n');

  const { setupEmail } = await inquirer.prompt([{
    type: 'confirm',
    name: 'setupEmail',
    message: 'Set up Gmail App Password for OTP emails now?',
    default: false
  }]);

  let emailCfg = { enabled: false };

  if (setupEmail) {
    console.log('\n  To get an App Password:');
    console.log('  1. Go to myaccount.google.com/security');
    console.log('  2. Enable 2-Step Verification (if not already on)');
    console.log('  3. Search "App passwords" → create one → copy the 16-char code\n');

    const gm = await inquirer.prompt([
      {
        name: 'user',
        message: 'Your Gmail address:',
        validate: v => v.includes('@gmail.com') ? true : 'Must be a @gmail.com address'
      },
      {
        name: 'pass',
        message: 'App Password (16 chars, spaces are fine):',
        validate: v => v.replace(/\s/g, '').length === 16 ? true : 'Must be exactly 16 characters'
      }
    ]);

    emailCfg = {
      enabled: true,
      provider: 'gmail',
      user: gm.user.trim(),
      pass: gm.pass.replace(/\s/g, '')
    };

    console.log('\n  Gmail OTP configured.\n');
  }

  // ── Build config ─────────────────────────────────────────────────────────
  const config = {
    project: { name: 'skeletal-demo', port: 3001 },
    database: { uri: 'mongodb://localhost:27017/skeletal-demo' },
    cors: { origins: ['http://localhost:3000'] },
    features: {
      auth: {
        enabled: true,
        jwtSecret: crypto.randomBytes(32).toString('hex'),
        tokenExpiry: '7d'
      },
      otp: {
        enabled: true,
        length: 6,
        expiry: 300,
        email: emailCfg,
        sms: { enabled: false, accountSid: '', authToken: '', from: '' }
      },
      webhooks: {
        enabled: true,
        secret: crypto.randomBytes(32).toString('hex')
      },
      crud: {
        enabled: true,
        models: [
          { name: 'task', fields: { title: 'String', description: 'String', done: 'Boolean' }, auth: true }
        ]
      }
    },
    websocket: { enabled: true }
  };

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
  console.log('  skeletal.config.json saved.');
  console.log('  CRUD model: task (title, description, done)');
  if (emailCfg.enabled) {
    console.log(`  Gmail OTP: enabled (${emailCfg.user})`);
  } else {
    console.log('  OTP email: disabled (run npm run setup to add later)');
  }

  try {
    const { generateSDK } = require('../sdk/generator');
    const { loadConfig } = require('../core/config');
    const sdkPath = generateSDK(loadConfig());
    console.log(`  Frontend SDK: ${sdkPath}`);
  } catch (e) {
    console.log('  (SDK generation skipped)');
  }

  console.log('\n  ─────────────────────────────────────────');
  console.log('  Start the backend:    npm start');
  console.log('  Start the demo UI:    node demo/server.js');
  console.log('  Open in browser:      http://localhost:3000');
  console.log('  ─────────────────────────────────────────\n');
}

main().catch(err => {
  if (err.message?.includes('force closed')) console.log('\n  Setup cancelled.');
  else console.error('Error:', err.message);
});
