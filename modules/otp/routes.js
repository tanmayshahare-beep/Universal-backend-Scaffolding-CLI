const express = require('express');
const controller = require('./controller');

function otpRoutes(config) {
  const router = express.Router();
  const wrap = fn => (req, res) => fn(req, res, config).catch(err => res.status(500).json({ error: err.message }));

  router.post('/send', wrap(controller.send));
  router.post('/verify', wrap(controller.verify));

  return router;
}

module.exports = otpRoutes;
