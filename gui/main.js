const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');

// ── Root path works in both dev and packaged modes ────────────────────────────
// Dev:      gui/../         = project root
// Packaged: resources/app/ = project root (asar:false)
function getAppRoot() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'app')
    : path.join(__dirname, '..');
}

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 700,
    minWidth: 860,
    minHeight: 560,
    backgroundColor: '#000000',
    icon: path.join(getAppRoot(), 'ascii-art.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  mainWindow.setMenuBarVisibility(false);
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

// ── IPC: pick a folder ────────────────────────────────────────────────────────
ipcMain.handle('open-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
  return result.canceled ? null : result.filePaths[0];
});

// ── IPC: load config ──────────────────────────────────────────────────────────
ipcMain.handle('load-config', async () => {
  const configPath = path.join(getAppRoot(), 'skeletal.config.json');
  if (!fs.existsSync(configPath)) return null;
  try { return JSON.parse(fs.readFileSync(configPath, 'utf8')); }
  catch { return null; }
});

// ── IPC: generate — save config + SDK + inject into frontend ──────────────────
ipcMain.handle('generate', async (_, { config, frontendPath }) => {
  try {
    const root = getAppRoot();

    fs.writeFileSync(path.join(root, 'skeletal.config.json'), JSON.stringify(config, null, 2), 'utf8');

    const { generateSDK } = require('../sdk/generator');
    const sdkDest = path.join(root, 'skeletal-client.js');
    generateSDK(config, sdkDest);

    if (frontendPath && fs.existsSync(frontendPath)) {
      fs.copyFileSync(sdkDest, path.join(frontendPath, 'skeletal-client.js'));
      const srcDir = path.join(frontendPath, 'src');
      if (fs.existsSync(srcDir)) {
        fs.copyFileSync(sdkDest, path.join(srcDir, 'skeletal-client.js'));
      }
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ── IPC: reveal folder in Explorer ───────────────────────────────────────────
ipcMain.handle('reveal-folder', async (_, folderPath) => {
  if (folderPath && fs.existsSync(folderPath)) shell.openPath(folderPath);
});

// ── IPC: start the backend server ─────────────────────────────────────────────
// Dev mode:      spawns `node start.js` silently in the background.
// Packaged mode: opens a visible terminal window so the user can see logs
//                and close the server when they're done.
ipcMain.handle('start-server', async () => {
  const root = getAppRoot();
  const { spawn } = require('child_process');

  if (app.isPackaged) {
    // Open a new CMD window that stays open after the server starts
    spawn('cmd.exe', ['/c', 'start', 'cmd', '/k', `cd /d "${root}" && node start.js`], {
      detached: true,
      stdio: 'ignore',
      shell: false
    }).unref();
    return { pid: -1, mode: 'terminal' };
  } else {
    // Dev: run silently, return PID
    const proc = spawn('node', ['start.js'], { cwd: root, detached: true, stdio: 'ignore' });
    proc.unref();
    return { pid: proc.pid, mode: 'background' };
  }
});
