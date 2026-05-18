const express = require('express');
const controller = require('./controller');

function webhookRoutes(config) {
  const router = express.Router();
  const wrap = fn => (req, res) => fn(req, res, config).catch(err => res.status(500).json({ error: err.message }));

  router.post('/register', wrap(controller.register));
  router.get('/', wrap(controller.list));
  router.delete('/:id', wrap(controller.remove));
  router.post('/trigger', wrap(controller.trigger));
  router.post('/inbound', wrap(controller.inbound));

  return router;
}

module.exports = webhookRoutes;
