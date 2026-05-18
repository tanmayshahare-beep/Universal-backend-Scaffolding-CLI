const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authMiddleware } = require('../auth/middleware');

function uploadsRoutes(config) {
  const router = express.Router();
  const uploadCfg = config.features?.uploads || {};

  const destination = uploadCfg.destination || 'uploads/';
  fs.mkdirSync(destination, { recursive: true });
  const maxSizeMb = uploadCfg.maxSizeMb || 5;
  const allowedTypes = uploadCfg.allowedTypes || null;
  const maxFiles = uploadCfg.maxFiles || 10;
  const requireAuth = uploadCfg.auth !== false && config.features?.auth?.enabled;

  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, destination),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      const base = path.basename(file.originalname, ext).replace(/[^a-z0-9_-]/gi, '_');
      cb(null, `${Date.now()}-${base}${ext}`);
    }
  });

  const fileFilter = allowedTypes
    ? (req, file, cb) => {
        if (allowedTypes.includes(file.mimetype)) cb(null, true);
        else cb(new Error(`File type not allowed. Allowed: ${allowedTypes.join(', ')}`));
      }
    : undefined;

  const upload = multer({
    storage,
    limits: { fileSize: maxSizeMb * 1024 * 1024 },
    fileFilter
  });

  const guard = requireAuth ? [authMiddleware(config)] : [];

  const wrap = fn => async (req, res) => {
    try { await fn(req, res); }
    catch (err) { res.status(500).json({ error: err.message }); }
  };

  router.post('/single', ...guard, (req, res, next) => {
    upload.single('file')(req, res, err => {
      if (err) return res.status(400).json({ error: err.message });
      next();
    });
  }, wrap(async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    res.json({
      url: `/uploads/${req.file.filename}`,
      filename: req.file.filename,
      originalname: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype
    });
  }));

  router.post('/multiple', ...guard, (req, res, next) => {
    upload.array('files', maxFiles)(req, res, err => {
      if (err) return res.status(400).json({ error: err.message });
      next();
    });
  }, wrap(async (req, res) => {
    if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'No files uploaded' });
    res.json({
      files: req.files.map(f => ({
        url: `/uploads/${f.filename}`,
        filename: f.filename,
        originalname: f.originalname,
        size: f.size,
        mimetype: f.mimetype
      }))
    });
  }));

  return router;
}

module.exports = uploadsRoutes;
