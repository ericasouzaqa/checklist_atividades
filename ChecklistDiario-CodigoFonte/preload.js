const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  loadData: () => ipcRenderer.invoke('load-data'),
  saveData: (data) => ipcRenderer.invoke('save-data', data),
  togglePin: (pinned) => ipcRenderer.invoke('toggle-pin', pinned),
  minimize: () => ipcRenderer.invoke('minimize'),
  closeApp: () => ipcRenderer.invoke('close-app'),
  exportCsv: (content) => ipcRenderer.invoke('export-csv', content),
  exportXlsx: (buffer) => ipcRenderer.invoke('export-xlsx', buffer),
  toggleAutostart: (enable) => ipcRenderer.invoke('toggle-autostart', enable),
  getAutostart: () => ipcRenderer.invoke('get-autostart'),

  onCloseRequested: (callback) =>
    ipcRenderer.on('app-close-requested', () => callback()),

  confirmClose: () => ipcRenderer.send('app-close-confirmed'),
});
