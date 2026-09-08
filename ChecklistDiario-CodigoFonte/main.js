const { app, BrowserWindow, ipcMain } = require('electron');
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
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.loadFile('index.html');
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

// --- IPC: dados (persistidos em arquivo, fora do app) ---
ipcMain.handle('load-data', () => {
  try {
    const raw = fs.readFileSync(getDataFile(), 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    return null;
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
