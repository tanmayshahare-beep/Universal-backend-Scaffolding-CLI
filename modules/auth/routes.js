const express = require('express');
const controller = require('./controller');
const { authMiddleware } = require('./middleware');

function authRoutes(config) {
  const router = express.Router();
  const wrap = fn => (req, res) => fn(req, res, config).catch(err => res.status(500).json({ error: err.message }));

  router.post('/register', wrap(controller.register));
  router.post('/login', wrap(controller.login));
  router.post('/refresh', wrap(controller.refresh));
  router.post('/logout', wrap(controller.logout));
  router.get('/me', authMiddleware(config), wrap(controller.me));
  router.post('/forgot-password', wrap(controller.forgotPassword));
  router.post('/reset-password', wrap((req, res) => controller.resetPassword(req, res)));

  return router;
}

module.exports = authRoutes;
