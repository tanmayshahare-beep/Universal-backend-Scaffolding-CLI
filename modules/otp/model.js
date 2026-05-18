const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({
  target: { type: String, required: true },
  type: { type: String, enum: ['email', 'sms'], required: true },
  code: { type: String, required: true },
  purpose: { type: String, default: 'verify' },
  used: { type: Boolean, default: false },
  expiresAt: { type: Date, required: true }
}, { timestamps: true });

otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('OTP', otpSchema);
