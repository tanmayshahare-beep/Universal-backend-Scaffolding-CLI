const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('skeletalAPI', {
  openFolder:    ()              => ipcRenderer.invoke('open-folder'),
  loadConfig:    ()              => ipcRenderer.invoke('load-config'),
  generate:      (payload)       => ipcRenderer.invoke('generate', payload),
  revealFolder:  (folderPath)    => ipcRenderer.invoke('reveal-folder', folderPath),
  startServer:   ()              => ipcRenderer.invoke('start-server'),
});
