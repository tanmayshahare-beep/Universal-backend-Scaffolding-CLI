const mongoose = require('mongoose');

const webhookSchema = new mongoose.Schema({
  url: { type: String, required: true },
  events: [{ type: String }],
  secret: { type: String },
  active: { type: Boolean, default: true },
  label: { type: String },
  failCount: { type: Number, default: 0 },
  lastTriggeredAt: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('Webhook', webhookSchema);
