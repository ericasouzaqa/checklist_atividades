const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  loadData: () => ipcRenderer.invoke('load-data'),
  saveData: (data) => ipcRenderer.invoke('save-data', data),
  togglePin: (pinned) => ipcRenderer.invoke('toggle-pin', pinned),
  isPinned: () => ipcRenderer.invoke('is-pinned'),
  toggleMaximize: () => ipcRenderer.invoke('maximize-toggle'),
  minimize: () => ipcRenderer.invoke('minimize')
});
