const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

function createServer(config) {
  const app = express();
  const server = http.createServer(app);

  const allowedOrigins = config.cors?.origins || ['*'];
  app.use(cors({ origin: allowedOrigins, credentials: true }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  const features = config.features || {};

  if (features.logging?.enabled) {
    const morgan = require('morgan');
    app.use(morgan(features.logging.format || 'dev'));
  }

  const { createLimiters } = require('../modules/ratelimit');
  const { globalLimiter, authLimiter } = createLimiters(config);
  app.use('/api', globalLimiter);
  app.use('/api/auth/login', authLimiter);
  app.use('/api/auth/forgot-password', authLimiter);

  const io = new Server(server, {
    cors: { origin: allowedOrigins, methods: ['GET', 'POST'] }
  });

  app.set('io', io);

  // Mount enabled modules

  if (features.auth?.enabled) {
    const authRoutes = require('../modules/auth/routes');
    app.use('/api/auth', authRoutes(config));
  }

  if (features.otp?.enabled) {
    const otpRoutes = require('../modules/otp/routes');
    app.use('/api/otp', otpRoutes(config));
  }

  if (features.webhooks?.enabled) {
    const webhookRoutes = require('../modules/webhooks/routes');
    app.use('/api/webhooks', webhookRoutes(config));
  }

  if (features.crud?.enabled && Array.isArray(features.crud.models)) {
    const { generateCrudRoutes } = require('../modules/crud/generator');
    features.crud.models.forEach(model => {
      const router = generateCrudRoutes(model, config);
      app.use(`/api/${model.name.toLowerCase()}`, router);
    });
  }

  if (features.uploads?.enabled) {
    const uploadsRoutes = require('../modules/uploads/routes');
    const uploadDest = features.uploads.destination || 'uploads/';
    app.use('/api/uploads', uploadsRoutes(config));
    app.use('/uploads', express.static(uploadDest));
  }

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', project: config.project.name, timestamp: new Date().toISOString() });
  });

  if (config.websocket?.enabled) {
    io.on('connection', (socket) => {
      socket.on('join', (room) => socket.join(room));
      socket.on('leave', (room) => socket.leave(room));
      socket.on('disconnect', () => {});
    });
  }

  return { app, io, server };
}

module.exports = { createServer };
