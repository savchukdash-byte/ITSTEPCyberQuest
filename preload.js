const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('cq', {
  quit: (pwd) => ipcRenderer.invoke('quit', pwd),
  externalPack: () => ipcRenderer.sendSync('pack'),
});
