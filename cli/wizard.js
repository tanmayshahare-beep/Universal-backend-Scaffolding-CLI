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
        { name: 'Auto CRUD (schema → REST endpoints)', value: 'crud', checked: cfg.features?.crud?.enabled !== false },
        { name: 'Rate Limiting (express-rate-limit)', value: 'rateLimit', checked: cfg.features?.rateLimit?.enabled === true },
        { name: 'File Uploads (multer)', value: 'uploads', checked: cfg.features?.uploads?.enabled === true },
        { name: 'Request Logging (morgan)', value: 'logging', checked: cfg.features?.logging?.enabled === true }
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
      const currentProvider = cfg.features?.otp?.email?.provider === 'gmail' ||
        (cfg.features?.otp?.email?.host || '').includes('gmail') ? 'gmail' : 'smtp';

      const { emailProvider } = await inquirer.prompt([{
        type: 'list',
        name: 'emailProvider',
        message: 'Email provider:',
        default: currentProvider,
        choices: [
          { name: 'Gmail App Password  (just your Gmail address + 16-char app password)', value: 'gmail' },
          { name: 'Custom SMTP         (Outlook, SendGrid, or any mail server)', value: 'smtp' }
        ]
      }]);

      if (emailProvider === 'gmail') {
        console.log('\n  Get an App Password: Google Account → Security → 2-Step Verification → App passwords\n');
        const gm = await inquirer.prompt([
          {
            name: 'user',
            message: 'Gmail address:',
            default: cfg.features?.otp?.email?.user || '',
            validate: v => v.includes('@') ? true : 'Enter a valid email address'
          },
          {
            name: 'pass',
            message: 'App Password (16 chars — spaces are ignored):',
            default: cfg.features?.otp?.email?.pass || '',
            validate: v => v.replace(/\s/g, '').length === 16 ? true : 'App password must be exactly 16 characters'
          }
        ]);
        emailCfg = {
          enabled: true,
          provider: 'gmail',
          user: gm.user.trim(),
          pass: gm.pass.replace(/\s/g, '')
        };
      } else {
        const em = await inquirer.prompt([
          { name: 'host', message: 'SMTP host:', default: cfg.features?.otp?.email?.host || '' },
          { name: 'port', message: 'SMTP port:', default: cfg.features?.otp?.email?.port || 587 },
          { name: 'user', message: 'SMTP user (email address):', default: cfg.features?.otp?.email?.user || '' },
          { name: 'pass', message: 'SMTP password:', default: cfg.features?.otp?.email?.pass || '' }
        ]);
        emailCfg = { enabled: true, ...em, port: Number(em.port) };
      }
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

  // ── Rate limit config ──────────────────────────────────────────────────────
  if (enabledFeatures.includes('rateLimit')) {
    const rl = await inquirer.prompt([
      {
        name: 'globalMax',
        message: 'Max requests per 15 min (global):',
        default: cfg.features?.rateLimit?.globalMax || 100
      },
      {
        name: 'authMax',
        message: 'Max requests per 15 min (auth routes):',
        default: cfg.features?.rateLimit?.authMax || 20
      }
    ]);
    features.rateLimit = {
      enabled: true,
      windowMs: 15 * 60 * 1000,
      globalMax: Number(rl.globalMax),
      authMax: Number(rl.authMax)
    };
  } else {
    features.rateLimit = { enabled: false };
  }

  // ── Uploads config ─────────────────────────────────────────────────────────
  if (enabledFeatures.includes('uploads')) {
    const up = await inquirer.prompt([
      {
        name: 'destination',
        message: 'Upload destination directory:',
        default: cfg.features?.uploads?.destination || 'uploads/'
      },
      {
        name: 'maxSizeMb',
        message: 'Max file size (MB):',
        default: cfg.features?.uploads?.maxSizeMb || 5
      },
      {
        type: 'confirm',
        name: 'auth',
        message: 'Require JWT auth for uploads?',
        default: cfg.features?.uploads?.auth !== false
      }
    ]);
    features.uploads = {
      enabled: true,
      destination: up.destination,
      maxSizeMb: Number(up.maxSizeMb),
      auth: up.auth
    };
  } else {
    features.uploads = { enabled: false };
  }

  // ── Logging config ─────────────────────────────────────────────────────────
  if (enabledFeatures.includes('logging')) {
    const lg = await inquirer.prompt([
      {
        type: 'list',
        name: 'format',
        message: 'Log format:',
        default: cfg.features?.logging?.format || 'dev',
        choices: [
          { name: 'dev      (colored, short)', value: 'dev' },
          { name: 'combined (Apache combined)', value: 'combined' },
          { name: 'tiny     (minimal)', value: 'tiny' }
        ]
      }
    ]);
    features.logging = { enabled: true, format: lg.format };
  } else {
    features.logging = { enabled: false };
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

      let roles = [];
      if (modelInfo.auth) {
        const { rolesInput } = await inquirer.prompt([
          { name: 'rolesInput', message: 'Restrict to roles (comma-separated, blank = any auth user):', default: '' }
        ]);
        roles = rolesInput.split(',').map(r => r.trim()).filter(Boolean);
      }

      const { softDelete } = await inquirer.prompt([
        { type: 'confirm', name: 'softDelete', message: 'Enable soft delete for this model?', default: false }
      ]);

      const entry = {
        name: modelInfo.name.toLowerCase(),
        fields: JSON.parse(modelInfo.fields),
        auth: modelInfo.auth,
        softDelete
      };
      if (roles.length) entry.roles = roles;

      models.push(entry);
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
