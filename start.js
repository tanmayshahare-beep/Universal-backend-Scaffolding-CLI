require('dotenv').config();
const { createServer } = require('./core/server');
const { connectDB } = require('./core/db');
const { loadConfig } = require('./core/config');

async function main() {
  const config = loadConfig();

  await connectDB(config.database.uri);

  const { app, io, server } = createServer(config);

  const port = process.env.PORT || config.project.port || 3001;
  server.listen(port, () => {
    console.log(`\n[skeletal-dock] Server running on port ${port}`);
    console.log(`[skeletal-dock] Enabled modules: ${getEnabledModules(config).join(', ')}`);
    if (config.websocket?.enabled) {
      console.log(`[skeletal-dock] WebSocket ready`);
    }
    console.log(`[skeletal-dock] API base: http://localhost:${port}/api\n`);
  });
}

function getEnabledModules(config) {
  return Object.entries(config.features || {})
    .filter(([, v]) => v.enabled)
    .map(([k]) => k);
}

main().catch(err => {
  console.error('[skeletal-dock] Startup failed:', err.message);
  process.exit(1);
});
