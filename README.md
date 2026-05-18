# skeletal-dock

A universal backend scaffold you drop into any project. Run one wizard in the terminal, get a fully configured Express + MongoDB + Socket.io backend with auth, OTP, webhooks, and auto-generated REST endpoints — plus a ready-to-use frontend SDK.

---

## What it does

| Module | What you get |
|---|---|
| **Auth** | Register, login, logout, refresh tokens — JWT + bcrypt |
| **OTP** | Send & verify codes via Email (SMTP) or SMS (Twilio) |
| **Webhooks** | Register listener URLs, trigger events, receive inbound webhooks with HMAC signing |
| **Auto CRUD** | Define a schema in the wizard → instant paginated REST endpoints |
| **WebSocket** | Socket.io layer included, broadcasts webhook events in real time |
| **Frontend SDK** | Auto-generated `skeletal-client.js` — drop it into any frontend |

---

## Quick Start

```bash
# 1. Install dependencies (once)
npm install

# 2. Run the setup wizard
npm run setup

# 3. Start the server
npm start
```

The wizard writes `skeletal.config.json`. The server starts on the port you chose (default **3001**).

---

## Using in a New Project

1. Copy this entire `skeletal-dock` folder into your project directory (or keep it as a shared folder)
2. `cd` into it and run `npm run setup` — configure it for this specific project
3. `npm start` — backend is live
4. Copy the generated `skeletal-client.js` into your frontend source folder
5. Import and call it from your frontend — no extra setup needed

---

## CLI Commands

```bash
npm run setup                      # Full wizard: configure everything from scratch
npm start                          # Start the backend server
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
POST /api/auth/register      { email, password, name }
POST /api/auth/login         { email, password }
POST /api/auth/refresh       { refreshToken }
POST /api/auth/logout        { refreshToken }
GET  /api/auth/me            Authorization: Bearer <token>
```

### OTP
```
POST /api/otp/send           { target, type: "email"|"sms", purpose? }
POST /api/otp/verify         { target, code, type, purpose? }
```

### Webhooks
```
POST   /api/webhooks/register    { url, events?, label?, secret? }
GET    /api/webhooks
DELETE /api/webhooks/:id
POST   /api/webhooks/trigger     { event, data }
POST   /api/webhooks/inbound     (receives signed webhook payloads)
```

### Auto CRUD (per model)
```
GET    /api/<model>          ?page=1&limit=20&sort=-createdAt&<filters>
GET    /api/<model>/:id
POST   /api/<model>          { ...fields }
PUT    /api/<model>/:id      { ...fields }
DELETE /api/<model>/:id
```

---

## Frontend SDK Usage

After `npm run setup`, a `skeletal-client.js` is generated. Copy it into your frontend.

```js
import { skeletalAuth, skeletalOTP, skeletalWebhooks, skeletalProduct } from './skeletal-client.js';

// Auth
const { user, accessToken } = await skeletalAuth.register('user@email.com', 'pass123');
const { user, accessToken, refreshToken } = await skeletalAuth.login('user@email.com', 'pass123');
const profile = await skeletalAuth.me(accessToken);

// OTP
await skeletalOTP.send('user@email.com', 'email');
const { verified } = await skeletalOTP.verify('user@email.com', '123456', 'email');

// Webhooks
await skeletalWebhooks.register('https://yoursite.com/hook', ['order.created', 'payment.done']);
await skeletalWebhooks.trigger('order.created', { orderId: '123' }, accessToken);

// Auto CRUD (example model: product)
await skeletalProduct.create({ name: 'Widget', price: 9.99 }, accessToken);
const { data } = await skeletalProduct.list({ limit: 10 }, accessToken);

// WebSocket (requires socket.io-client in your frontend)
import { io } from 'socket.io-client';
const socket = io('http://localhost:3001');
socket.on('webhook:received', (payload) => console.log(payload));
```

---

## Configuration File

`skeletal.config.json` is created by the wizard. You can edit it manually and restart the server.

```json
{
  "project": { "name": "my-app", "port": 3001 },
  "database": { "uri": "mongodb://localhost:27017/my-app" },
  "cors": { "origins": ["http://localhost:3000"] },
  "features": {
    "auth": { "enabled": true, "jwtSecret": "...", "tokenExpiry": "7d" },
    "otp": {
      "enabled": true, "length": 6, "expiry": 300,
      "email": { "enabled": true, "host": "smtp.gmail.com", "port": 587, "user": "...", "pass": "..." },
      "sms": { "enabled": false, "accountSid": "", "authToken": "", "from": "" }
    },
    "webhooks": { "enabled": true, "secret": "..." },
    "crud": {
      "enabled": true,
      "models": [
        { "name": "product", "fields": { "name": "String", "price": "Number" }, "auth": true }
      ]
    }
  },
  "websocket": { "enabled": true }
}
```

### Supported field types for CRUD models
`String` `Number` `Boolean` `Date` `ObjectId` `Mixed` `Array`

---

## Environment Variables

Create a `.env` file (copy from `.env.example`) to override config values:

```env
PORT=3001
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/mydb
```

---

## Project Structure

```
skeletal-dock/
├── cli/
│   ├── index.js          CLI entry point
│   └── wizard.js         Interactive setup wizard
├── core/
│   ├── server.js         Express + Socket.io setup
│   ├── db.js             MongoDB connection
│   └── config.js         Config loader/saver
├── modules/
│   ├── auth/             JWT auth module
│   ├── otp/              OTP module (email + SMS)
│   ├── webhooks/         Webhook module
│   └── crud/             Auto CRUD generator
├── sdk/
│   └── generator.js      Generates skeletal-client.js
├── start.js              Server entry point
├── skeletal.config.json  Your config (created by wizard)
└── skeletal-client.js    Frontend SDK (generated by wizard)
```

---

## Adding a New CRUD Model Without Re-Running the Full Wizard

```bash
node cli/index.js add-model
```

Prompts: model name, fields as JSON, whether to require auth. Updates config and regenerates the SDK. Restart the server to activate the new endpoints.

---

## Webhook Signing Verification (in your receiver)

Outbound webhooks sent by skeletal-dock include an `X-Skeletal-Signature` header:

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
