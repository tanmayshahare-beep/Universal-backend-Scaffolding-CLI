const express = require('express');
const mongoose = require('mongoose');
const { authMiddleware } = require('../auth/middleware');

const TYPE_MAP = {
  String: String,
  Number: Number,
  Boolean: Boolean,
  Date: Date,
  ObjectId: mongoose.Schema.Types.ObjectId,
  Mixed: mongoose.Schema.Types.Mixed,
  Array: Array
};

const modelCache = {};

function buildModel(modelDef) {
  if (modelCache[modelDef.name]) return modelCache[modelDef.name];

  const schemaFields = {};
  for (const [field, type] of Object.entries(modelDef.fields || {})) {
    if (typeof type === 'string') {
      schemaFields[field] = { type: TYPE_MAP[type] || String };
    } else {
      schemaFields[field] = type;
    }
  }

  const schema = new mongoose.Schema(schemaFields, { timestamps: true });
  const name = modelDef.name.charAt(0).toUpperCase() + modelDef.name.slice(1);

  // Avoid model re-registration on hot reload
  const model = mongoose.models[name] || mongoose.model(name, schema);
  modelCache[modelDef.name] = model;
  return model;
}

function generateCrudRoutes(modelDef, config) {
  const router = express.Router();
  const Model = buildModel(modelDef);
  const requireAuth = modelDef.auth !== false && config.features.auth?.enabled;
  const guard = requireAuth ? [authMiddleware(config)] : [];

  const wrap = fn => async (req, res) => {
    try { await fn(req, res); }
    catch (err) { res.status(500).json({ error: err.message }); }
  };

  // List
  router.get('/', ...guard, wrap(async (req, res) => {
    const { page = 1, limit = 20, sort = '-createdAt', ...filters } = req.query;
    const docs = await Model.find(filters)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(Number(limit));
    const total = await Model.countDocuments(filters);
    res.json({ data: docs, total, page: Number(page), limit: Number(limit) });
  }));

  // Get one
  router.get('/:id', ...guard, wrap(async (req, res) => {
    const doc = await Model.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    res.json({ data: doc });
  }));

  // Create
  router.post('/', ...guard, wrap(async (req, res) => {
    const doc = await Model.create(req.body);
    res.status(201).json({ data: doc });
  }));

  // Update
  router.put('/:id', ...guard, wrap(async (req, res) => {
    const doc = await Model.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!doc) return res.status(404).json({ error: 'Not found' });
    res.json({ data: doc });
  }));

  // Delete
  router.delete('/:id', ...guard, wrap(async (req, res) => {
    const doc = await Model.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted' });
  }));

  return router;
}

module.exports = { generateCrudRoutes, buildModel };
