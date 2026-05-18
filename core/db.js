const mongoose = require('mongoose');

async function connectDB(uri) {
  if (!uri) {
    console.error('[skeletal-dock] No database URI in config. Run: npm run setup');
    process.exit(1);
  }
  try {
    await mongoose.connect(uri);
    console.log('[skeletal-dock] MongoDB connected');
  } catch (err) {
    console.error('[skeletal-dock] MongoDB connection failed:', err.message);
    process.exit(1);
  }
}

module.exports = { connectDB };
