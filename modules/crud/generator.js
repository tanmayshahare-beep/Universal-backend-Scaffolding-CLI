const express = require('express');
const mongoose = require('mongoose');
const { authMiddleware, roleMiddleware } = require('../auth/middleware');
const { buildValidator } = require('./validator');

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
  for (const [field, def] of Object.entries(modelDef.fields || {})) {
    if (typeof def === 'string') {
      schemaFields[field] = { type: TYPE_MAP[def] || String };
    } else if (def && typeof def === 'object' && def.type) {
      const schemaDef = { type: TYPE_MAP[def.type] || String };
      if (def.required) schemaDef.required = true;
      if (def.enum) schemaDef.enum = def.enum;
      if (def.default !== undefined) schemaDef.default = def.default;
      schemaFields[field] = schemaDef;
    } else {
      schemaFields[field] = def;
    }
  }

  if (modelDef.softDelete) {
    schemaFields.deletedAt = { type: Date, default: null };
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
  const softDelete = !!modelDef.softDelete;

  const guard = [];
  if (requireAuth) guard.push(authMiddleware(config));
  if (requireAuth && modelDef.roles?.length) guard.push(roleMiddleware(...modelDef.roles));

  const validator = buildValidator(modelDef.fields);

  const wrap = fn => async (req, res) => {
    try { await fn(req, res); }
    catch (err) { res.status(500).json({ error: err.message }); }
  };

  const baseFilter = softDelete
    ? { $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }] }
    : {};

  // List
  router.get('/', ...guard, wrap(async (req, res) => {
    const { page = 1, limit = 20, sort = '-createdAt', ...filters } = req.query;
    const query = Object.assign({}, filters, baseFilter);
    const docs = await Model.find(query)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(Number(limit));
    const total = await Model.countDocuments(query);
    res.json({ data: docs, total, page: Number(page), limit: Number(limit) });
  }));

  // Get one
  router.get('/:id', ...guard, wrap(async (req, res) => {
    const query = Object.assign({ _id: req.params.id }, baseFilter);
    const doc = await Model.findOne(query);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    res.json({ data: doc });
  }));

  // Create
  router.post('/', ...guard, validator, wrap(async (req, res) => {
    const doc = await Model.create(req.body);
    res.status(201).json({ data: doc });
  }));

  // Update
  router.put('/:id', ...guard, validator, wrap(async (req, res) => {
    const query = Object.assign({ _id: req.params.id }, baseFilter);
    const doc = await Model.findOneAndUpdate(query, req.body, { new: true, runValidators: true });
    if (!doc) return res.status(404).json({ error: 'Not found' });
    res.json({ data: doc });
  }));

  // Delete
  router.delete('/:id', ...guard, wrap(async (req, res) => {
    if (softDelete) {
      const query = Object.assign({ _id: req.params.id }, baseFilter);
      const doc = await Model.findOneAndUpdate(query, { deletedAt: new Date() }, { new: true });
      if (!doc) return res.status(404).json({ error: 'Not found' });
      return res.json({ message: 'Deleted' });
    }
    const doc = await Model.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted' });
  }));

  // Restore (soft delete only)
  if (softDelete) {
    router.post('/:id/restore', ...guard, wrap(async (req, res) => {
      const doc = await Model.findByIdAndUpdate(
        req.params.id,
        { deletedAt: null },
        { new: true }
      );
      if (!doc) return res.status(404).json({ error: 'Not found' });
      res.json({ data: doc });
    }));
  }

  return router;
}

module.exports = { generateCrudRoutes, buildModel };
