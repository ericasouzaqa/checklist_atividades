const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  loadData: () => ipcRenderer.invoke('load-data'),
  saveData: (data) => ipcRenderer.invoke('save-data', data),
  togglePin: (pinned) => ipcRenderer.invoke('toggle-pin', pinned),
  minimize: () => ipcRenderer.invoke('minimize'),
  closeApp: () => ipcRenderer.invoke('close-app'),
  exportCsv: (content) => ipcRenderer.invoke('export-csv', content),
  // Substitui exportXlsx (aba única). Recebe { "Mes_Ano": [linhas...] }.
  exportXlsxMulti: (dadosPorMes) =>
    ipcRenderer.invoke('export-xlsx-multi', dadosPorMes),
  toggleAutostart: (enable) => ipcRenderer.invoke('toggle-autostart', enable),
  getAutostart: () => ipcRenderer.invoke('get-autostart'),

  // Requisito 12 (Links): abre URL no navegador padrão do sistema.
  openExternal: (url) => ipcRenderer.invoke('open-external', url),

  onCloseRequested: (callback) =>
    ipcRenderer.on('app-close-requested', () => callback()),

  confirmClose: () => ipcRenderer.send('app-close-confirmed'),
});
