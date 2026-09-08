const { app, BrowserWindow, ipcMain, Menu, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let win;

function getDataFile() {
  return path.join(app.getPath('userData'), 'checklist-data.json');
}

function createWindow() {
  win = new BrowserWindow({
    width: 380,
    height: 600,
    minWidth: 320,
    minHeight: 420,
    resizable: true,
    maximizable: true,
    minimizable: true,
    alwaysOnTop: false,
    title: 'Checklist Diário',
    backgroundColor: '#FFF3B0',
    icon: path.join(__dirname, 'icon.ico'), // 📌 Vincula o novo ícone do aplicativo
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadFile('index.html');

  // ✂️ Remove as barras de menu tradicionais que não fazem sentido (File, Edit, etc)
  Menu.setApplicationMenu(null);
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// --- IPC: janela ---
ipcMain.handle('toggle-pin', (event, pinned) => {
  win.setAlwaysOnTop(pinned, 'floating');
  return win.isAlwaysOnTop();
});

ipcMain.handle('is-pinned', () => {
  return win.isAlwaysOnTop();
});

ipcMain.handle('maximize-toggle', () => {
  if (win.isMaximized()) {
    win.unmaximize();
  } else {
    win.maximize();
  }
  return win.isMaximized();
});

ipcMain.handle('minimize', () => {
  win.minimize();
});

// --- IPC: dados (persistidos em arquivo por data) ---
ipcMain.handle('load-data', () => {
  try {
    const raw = fs.readFileSync(getDataFile(), 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    // Retorna um objeto vazio estruturado se o arquivo não existir
    return {};
  }
});

ipcMain.handle('save-data', (event, data) => {
  try {
    fs.writeFileSync(getDataFile(), JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (e) {
    return false;
  }
});

// --- IPC: Exportar para Planilha (CSV) ---
ipcMain.handle('export-csv', async (event, csvContent) => {
  const { filePath } = await dialog.showSaveDialog(win, {
    title: 'Exportar Tarefas',
    defaultPath: path.join(app.getPath('downloads'), 'Checklist_Tarefas.csv'),
    filters: [{ name: 'Arquivos CSV (*.csv)', extensions: ['csv'] }],
  });

  if (filePath) {
    try {
      // \ufeff força o Excel no Windows a abrir o arquivo com acentuação correta em PT-BR
      fs.writeFileSync(filePath, '\ufeff' + csvContent, 'utf-8');
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }
  return { success: false };
});
