const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.resolve(process.cwd(), 'skeletal.config.json');

function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    console.error('[skeletal-dock] No skeletal.config.json found. Run: npm run setup');
    process.exit(1);
  }
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch (e) {
    console.error('[skeletal-dock] Invalid skeletal.config.json:', e.message);
    process.exit(1);
  }
}

function saveConfig(config) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
}

function configExists() {
  return fs.existsSync(CONFIG_PATH);
}

module.exports = { loadConfig, saveConfig, configExists, CONFIG_PATH };
