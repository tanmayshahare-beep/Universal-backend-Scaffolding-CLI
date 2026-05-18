const inquirer = require('inquirer');
const crypto = require('crypto');

function randomSecret() {
  return crypto.randomBytes(32).toString('hex');
}

async function runWizard(existing) {
  const cfg = existing || {};

  console.log('\n  Welcome to skeletal-dock setup\n');

  // ── Project ────────────────────────────────────────────────────────────────
  const project = await inquirer.prompt([
    {
      name: 'name',
      message: 'Project name:',
      default: cfg.project?.name || 'my-app',
      validate: v => v.trim() ? true : 'Required'
    },
    {
      name: 'port',
      message: 'Backend port:',
      default: cfg.project?.port || 3001,
      validate: v => (Number(v) > 0 && Number(v) < 65536) ? true : 'Invalid port'
    },
    {
      name: 'corsOrigins',
      message: 'Allowed frontend origins (comma-separated):',
      default: cfg.cors?.origins?.join(',') || 'http://localhost:3000'
    }
  ]);

  // ── Database ───────────────────────────────────────────────────────────────
  const db = await inquirer.prompt([
    {
      name: 'uri',
      message: 'MongoDB URI:',
      default: cfg.database?.uri || 'mongodb://localhost:27017/' + project.name.replace(/\s+/g, '-'),
      validate: v => v.startsWith('mongodb') ? true : 'Must start with mongodb:// or mongodb+srv://'
    }
  ]);

  // ── Features ───────────────────────────────────────────────────────────────
  const { enabledFeatures } = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'enabledFeatures',
      message: 'Enable features:',
      choices: [
        { name: 'Auth (JWT login/register)', value: 'auth', checked: cfg.features?.auth?.enabled !== false },
        { name: 'OTP (email & SMS verification)', value: 'otp', checked: cfg.features?.otp?.enabled !== false },
        { name: 'Webhooks (send & receive)', value: 'webhooks', checked: cfg.features?.webhooks?.enabled !== false },
        { name: 'Auto CRUD (schema → REST endpoints)', value: 'crud', checked: cfg.features?.crud?.enabled !== false }
      ]
    }
  ]);

  const features = {};

  // ── Auth config ────────────────────────────────────────────────────────────
  if (enabledFeatures.includes('auth')) {
    const auth = await inquirer.prompt([
      {
        name: 'jwtSecret',
        message: 'JWT secret (leave blank to auto-generate):',
        default: cfg.features?.auth?.jwtSecret || ''
      },
      {
        name: 'tokenExpiry',
        message: 'Access token expiry:',
        default: cfg.features?.auth?.tokenExpiry || '7d'
      }
    ]);
    features.auth = {
      enabled: true,
      jwtSecret: auth.jwtSecret || randomSecret(),
      tokenExpiry: auth.tokenExpiry
    };
  } else {
    features.auth = { enabled: false };
  }

  // ── OTP config ─────────────────────────────────────────────────────────────
  if (enabledFeatures.includes('otp')) {
    const otpBase = await inquirer.prompt([
      {
        name: 'length',
        message: 'OTP code length:',
        default: cfg.features?.otp?.length || 6
      },
      {
        name: 'expiry',
        message: 'OTP expiry (seconds):',
        default: cfg.features?.otp?.expiry || 300
      },
      {
        type: 'checkbox',
        name: 'channels',
        message: 'Enable OTP channels:',
        choices: [
          { name: 'Email (SMTP)', value: 'email', checked: cfg.features?.otp?.email?.enabled !== false },
          { name: 'SMS (Twilio)', value: 'sms', checked: cfg.features?.otp?.sms?.enabled === true }
        ]
      }
    ]);

    let emailCfg = { enabled: false };
    if (otpBase.channels.includes('email')) {
      const em = await inquirer.prompt([
        { name: 'host', message: 'SMTP host:', default: cfg.features?.otp?.email?.host || 'smtp.gmail.com' },
        { name: 'port', message: 'SMTP port:', default: cfg.features?.otp?.email?.port || 587 },
        { name: 'user', message: 'SMTP user (email address):', default: cfg.features?.otp?.email?.user || '' },
        { name: 'pass', message: 'SMTP password / app password:', default: cfg.features?.otp?.email?.pass || '' }
      ]);
      emailCfg = { enabled: true, ...em, port: Number(em.port) };
    }

    let smsCfg = { enabled: false };
    if (otpBase.channels.includes('sms')) {
      const sm = await inquirer.prompt([
        { name: 'accountSid', message: 'Twilio Account SID:', default: cfg.features?.otp?.sms?.accountSid || '' },
        { name: 'authToken', message: 'Twilio Auth Token:', default: cfg.features?.otp?.sms?.authToken || '' },
        { name: 'from', message: 'Twilio "from" phone number:', default: cfg.features?.otp?.sms?.from || '' }
      ]);
      smsCfg = { enabled: true, ...sm };
    }

    features.otp = {
      enabled: true,
      length: Number(otpBase.length),
      expiry: Number(otpBase.expiry),
      email: emailCfg,
      sms: smsCfg
    };
  } else {
    features.otp = { enabled: false };
  }

  // ── Webhooks config ────────────────────────────────────────────────────────
  if (enabledFeatures.includes('webhooks')) {
    const wh = await inquirer.prompt([
      {
        name: 'secret',
        message: 'Webhook signing secret (blank to auto-generate):',
        default: cfg.features?.webhooks?.secret || ''
      }
    ]);
    features.webhooks = {
      enabled: true,
      secret: wh.secret || randomSecret()
    };
  } else {
    features.webhooks = { enabled: false };
  }

  // ── CRUD models ────────────────────────────────────────────────────────────
  if (enabledFeatures.includes('crud')) {
    const existingModels = cfg.features?.crud?.models || [];
    const models = [...existingModels];

    if (models.length === 0) {
      console.log('\n  No CRUD models defined yet.');
    } else {
      console.log(`\n  Existing models: ${models.map(m => m.name).join(', ')}`);
    }

    let addMore = true;
    while (addMore) {
      const { addModel } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'addModel',
          message: models.length === 0 ? 'Add a CRUD model now?' : 'Add another CRUD model?',
          default: models.length === 0
        }
      ]);
      if (!addModel) { addMore = false; break; }

      const modelInfo = await inquirer.prompt([
        { name: 'name', message: 'Model name (e.g. product, post):', validate: v => /^[a-z]+$/i.test(v) ? true : 'Use letters only' },
        { name: 'fields', message: 'Fields as JSON (e.g. {"title":"String","price":"Number"}):', validate: v => { try { JSON.parse(v); return true; } catch { return 'Invalid JSON'; } } },
        { type: 'confirm', name: 'auth', message: 'Require JWT auth for this model?', default: true }
      ]);

      models.push({
        name: modelInfo.name.toLowerCase(),
        fields: JSON.parse(modelInfo.fields),
        auth: modelInfo.auth
      });
      console.log(`  Model "${modelInfo.name}" added.`);
    }

    features.crud = { enabled: true, models };
  } else {
    features.crud = { enabled: false, models: [] };
  }

  // ── WebSocket ──────────────────────────────────────────────────────────────
  const { wsEnabled } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'wsEnabled',
      message: 'Enable WebSocket (Socket.io)?',
      default: cfg.websocket?.enabled !== false
    }
  ]);

  // ── SDK generation ─────────────────────────────────────────────────────────
  const { genSDK } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'genSDK',
      message: 'Generate skeletal-client.js (frontend SDK)?',
      default: true
    }
  ]);

  const config = {
    project: { name: project.name, port: Number(project.port) },
    database: { uri: db.uri },
    cors: { origins: project.corsOrigins.split(',').map(s => s.trim()) },
    features,
    websocket: { enabled: wsEnabled }
  };

  return { config, genSDK };
}

module.exports = { runWizard };
