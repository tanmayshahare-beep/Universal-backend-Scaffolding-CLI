# skeletal-dock

A universal backend scaffold you drop into any project. Configure it with a **desktop GUI wizard** or a terminal wizard, get a fully configured Express + MongoDB + Socket.io backend — plus a ready-to-use frontend SDK auto-injected into your project.

> Made with love and Claude.

---

## What it does

| Module | What you get |
|---|---|
| **Auth** | Register, login, logout, refresh tokens, forgot/reset password — JWT + bcrypt |
| **OTP** | Send & verify one-time codes via Email (Gmail or SMTP) or SMS (Twilio) |
| **Webhooks** | Register listener URLs, trigger events, receive inbound webhooks with HMAC signing |
| **Auto CRUD** | Define a schema in the wizard → instant paginated REST endpoints |
| **RBAC** | Per-model role restrictions — `roles: ["admin"]` limits access to specific user roles |
| **Input Validation** | Per-field rules (required, minLength, maxLength, min, max, enum) on CRUD write routes |
| **Soft Delete** | Per-model toggle — marks records deleted instead of removing them, with a restore endpoint |
| **File Uploads** | Single and multi-file upload via multer, served as static files |
| **Rate Limiting** | Global + stricter auth-route limiter via express-rate-limit |
| **Request Logging** | Morgan logger with configurable format (dev, combined, tiny) |
| **WebSocket** | Socket.io layer, broadcasts webhook events in real time |
| **Frontend SDK** | Auto-generated `skeletal-client.js` — drop it into any frontend |

---

## Quick Start

### Option A — GUI Wizard (recommended)

```bash
# 1. Install dependencies (once)
npm install

# 2. Open the desktop configurator
npm run gui
```

The GUI lets you:
- Toggle backend features on/off from a sidebar
- Configure each feature's settings in its own panel
- Point it at your frontend folder — the SDK is copied there automatically
- Click **Generate** to write `skeletal.config.json` and `skeletal-client.js`
- Click **Start Server** to launch the backend without leaving the app

The interface uses a pure black / pure white theme (toggle in the top-right corner) with Python-style syntax colours for values, types, and state indicators.

### Option B — Terminal Wizard

```bash
# 1. Install dependencies
npm install

# 2. Run the setup wizard
npm run setup

# 3. Start the server
npm start
```

The wizard writes `skeletal.config.json`. The server starts on the port you chose (default **3001**).

---

## Demo

A full browser-based feature tester is included.

```bash
# First time only — creates skeletal.config.json with demo settings
npm run demo:setup

# Terminal 1 — start the backend
npm start

# Terminal 2 — start the demo UI
npm run demo
```

Then open **http://localhost:3000**. The demo covers every module: auth, OTP, webhooks, CRUD, file uploads, password reset, and real-time WebSocket events.

---

## Using in a New Project

1. Copy this entire `skeletal-dock` folder into your project directory (or run it as a shared service)
2. `cd` into it and run `npm run gui` (or `npm run setup` for the CLI wizard)
3. In the GUI: browse to your frontend folder, configure features, click Generate
4. `npm start` — backend is live
5. `skeletal-client.js` is already in your frontend folder — import and use it

---

## CLI Commands

```bash
npm run gui                        # Open the desktop GUI configurator
npm run setup                      # Full terminal wizard: configure everything from scratch
npm start                          # Start the backend server
npm run demo:setup                 # Create a demo config (skeletal-demo project)
npm run demo                       # Start the demo UI on port 3000

node cli/index.js status           # Show what's enabled in current config
node cli/index.js add-model        # Add a new CRUD model without re-running full wizard
node cli/index.js regen-sdk        # Regenerate skeletal-client.js after config changes
node cli/index.js --help           # All available commands
```

---

## API Reference

All routes are prefixed with `/api`.

### Health
```
GET  /api/health
```

### Auth
```
POST /api/auth/register          { email, password, name }
POST /api/auth/login             { email, password }
POST /api/auth/refresh           { refreshToken }
POST /api/auth/logout            { refreshToken }
GET  /api/auth/me                Authorization: Bearer <token>
POST /api/auth/forgot-password   { email }
POST /api/auth/reset-password    { token, newPassword }
```

### OTP
```
POST /api/otp/send               { target, type: "email"|"sms", purpose? }
POST /api/otp/verify             { target, code, type, purpose? }
```

### Webhooks
```
POST   /api/webhooks/register    { url, events?, label?, secret? }
GET    /api/webhooks
DELETE /api/webhooks/:id
POST   /api/webhooks/trigger     { event, data }   — requires auth
POST   /api/webhooks/inbound     (receives signed webhook payloads)
```

### File Uploads
```
POST /api/uploads/single         multipart/form-data, field: "file"
POST /api/uploads/multiple       multipart/form-data, field: "files"
GET  /uploads/<filename>         serve uploaded file
```

### Auto CRUD (per model)
```
GET    /api/<model>              ?page=1&limit=20&sort=-createdAt&<filters>
GET    /api/<model>/:id
POST   /api/<model>              { ...fields }
PUT    /api/<model>/:id          { ...fields }
DELETE /api/<model>/:id
POST   /api/<model>/:id/restore  (soft delete models only)
```

---

## Frontend SDK Usage

After running the wizard or clicking Generate in the GUI, `skeletal-client.js` is ready in your frontend folder.

```js
import { skeletalAuth, skeletalOTP, skeletalWebhooks, skeletalUploads, skeletalProduct } from './skeletal-client.js';

// Auth
const { user, accessToken, refreshToken } = await skeletalAuth.register('user@email.com', 'pass123', 'Alice');
const { user, accessToken, refreshToken } = await skeletalAuth.login('user@email.com', 'pass123');
const { user } = await skeletalAuth.me(accessToken);
await skeletalAuth.logout(refreshToken);

// Password reset
await skeletalAuth.forgotPassword('user@email.com');
await skeletalAuth.resetPassword(token, 'newpassword123');

// OTP
await skeletalOTP.send('user@email.com', 'email');
const { verified } = await skeletalOTP.verify('user@email.com', '123456', 'email');

// Webhooks
await skeletalWebhooks.register('https://yoursite.com/hook', ['order.created', 'payment.done']);
await skeletalWebhooks.trigger('order.created', { orderId: '123' }, accessToken);

// File uploads
const form = new FormData();
form.append('file', fileInput.files[0]);
const { url } = await skeletalUploads.single(form, accessToken);

const multi = new FormData();
fileInput.files.forEach(f => multi.append('files', f));
const { files } = await skeletalUploads.multiple(multi, accessToken);

// Auto CRUD (example model: product)
await skeletalProduct.create({ name: 'Widget', price: 9.99 }, accessToken);
const { data, total } = await skeletalProduct.list({ page: 1, limit: 10 }, accessToken);
await skeletalProduct.update('64f...id', { price: 12.99 }, accessToken);
await skeletalProduct.remove('64f...id', accessToken);

// WebSocket (requires socket.io-client in your frontend)
import { io } from 'socket.io-client';
const socket = io('http://localhost:3001');
socket.on('webhook:received', (payload) => console.log(payload));
```

---

## Configuration File

`skeletal.config.json` is created by the wizard or the GUI. You can edit it manually and restart the server.

```json
{
  "project": { "name": "my-app", "port": 3001 },
  "database": { "uri": "mongodb://localhost:27017/my-app" },
  "cors": { "origins": ["http://localhost:3000"] },
  "features": {
    "auth": { "enabled": true, "jwtSecret": "...", "tokenExpiry": "7d" },
    "otp": {
      "enabled": true, "length": 6, "expiry": 300,
      "email": { "enabled": true, "provider": "gmail", "user": "you@gmail.com", "pass": "app-password" },
      "sms": { "enabled": false, "accountSid": "", "authToken": "", "from": "" }
    },
    "webhooks": { "enabled": true, "secret": "..." },
    "crud": {
      "enabled": true,
      "models": [
        {
          "name": "product",
          "fields": {
            "name": { "type": "String", "required": true, "minLength": 2 },
            "price": { "type": "Number", "required": true, "min": 0 },
            "inStock": "Boolean"
          },
          "auth": true,
          "roles": ["admin"],
          "softDelete": true
        }
      ]
    },
    "rateLimit": { "enabled": true, "globalMax": 100, "authMax": 20, "windowMs": 900000 },
    "uploads": { "enabled": true, "destination": "uploads/", "maxSizeMb": 5, "maxFiles": 10, "auth": true },
    "logging": { "enabled": true, "format": "dev" }
  },
  "websocket": { "enabled": true }
}
```

### CRUD field definitions

Fields accept either a simple type string or a validation object:

```json
"fields": {
  "title": "String",
  "price": { "type": "Number", "required": true, "min": 0, "max": 10000 },
  "status": { "type": "String", "enum": ["draft", "published"] },
  "body":   { "type": "String", "required": true, "minLength": 10, "maxLength": 5000 }
}
```

Supported field types: `String` `Number` `Boolean` `Date` `ObjectId` `Mixed` `Array`

Validation rules: `required` `minLength` `maxLength` `min` `max` `enum`

### RBAC

Set `"roles": ["admin"]` on a CRUD model to restrict it to users whose `role` field matches. Users are created with `role: "user"` by default. Change a user's role directly in MongoDB or add an admin endpoint to your app.

### Soft Delete

Set `"softDelete": true` on a CRUD model. `DELETE /api/<model>/:id` sets `deletedAt` instead of removing the document. List and get endpoints automatically filter out deleted records. Use `POST /api/<model>/:id/restore` to undelete.

---

## Environment Variables

Create a `.env` file (copy from `.env.example`) to override config values:

```env
PORT=3001
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/mydb
NODE_ENV=production
```

`NODE_ENV=production` suppresses the development-only reset token in the forgot-password response.

---

## Gmail App Password Setup

To use Gmail for OTP and password-reset emails:

1. Go to **myaccount.google.com/security**
2. Enable **2-Step Verification**
3. Search **App passwords** → create one → copy the 16-character code
4. In the wizard (GUI or CLI), choose **Gmail App Password** and enter your Gmail address + the 16-char code

---

## Project Structure

```
skeletal-dock/
├── gui/
│   ├── main.js            Electron main process (window, IPC handlers)
│   ├── preload.js         Context bridge (renderer ↔ main)
│   └── renderer/
│       ├── index.html     GUI shell
│       ├── styles.css     Minimalist theme (dark / light, Python syntax colours)
│       └── app.js         UI logic, state, theme toggle
├── cli/
│   ├── index.js           CLI entry point
│   └── wizard.js          Interactive terminal setup wizard
├── core/
│   ├── server.js          Express + Socket.io setup
│   ├── db.js              MongoDB connection
│   └── config.js          Config loader/saver
├── modules/
│   ├── auth/              JWT auth, password reset, RBAC middleware
│   ├── otp/               OTP module (email + SMS)
│   ├── webhooks/          Webhook module
│   ├── crud/              Auto CRUD generator + validator
│   ├── uploads/           File upload routes (multer)
│   ├── email/             Shared email utility
│   └── ratelimit/         Rate limiter factory
├── sdk/
│   └── generator.js       Generates skeletal-client.js
├── demo/
│   ├── index.html         Browser-based feature tester
│   ├── server.js          Serves demo UI on port 3000
│   └── setup-demo.js      Creates a demo skeletal.config.json
├── start.js               Server entry point
├── skeletal.config.json   Your config (created by wizard or GUI)
└── skeletal-client.js     Frontend SDK (generated by wizard or GUI)
```

---

## Webhook Signature Verification

Outbound webhooks include an `X-Skeletal-Signature` header:

```js
const crypto = require('crypto');

function verifySignature(body, secret, signature) {
  const expected = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(body))
    .digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}
```

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `No skeletal.config.json found` | Run `npm run gui` or `npm run setup` |
| `MongoDB connection failed` | Check your URI; for Atlas, whitelist your IP |
| OTP email not sending | Use a Gmail App Password, not your real password |
| CORS errors | Re-run setup and add your frontend origin |
| `Cannot find module` | Run `npm install` |
| `skeletal-client.js` is outdated | Click Generate in the GUI, or run `node cli/index.js regen-sdk` |
| Rate limit errors in testing | Increase `globalMax` / `authMax` in config, or disable `rateLimit` |
| Upload fails with "destination does not exist" | Restart the server — the folder is created on startup |
| Password reset token not in response | Set `NODE_ENV=production` to hide it, or leave unset for dev |
| GUI won't open | Run `npm install` first; requires Electron (installed as devDependency) |
