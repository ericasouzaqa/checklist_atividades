const { app, BrowserWindow, ipcMain, Menu, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let win;
let isReadyToClose = false; // Controle de estado unificado para o Handshake IPC
let intervaloBackup = null; // Guardará a instância do Timer de 4 horas

// Retorna o caminho da subpasta Backups dentro do diretório userData do usuário
function getBackupFolder() {
  const baseDir = app.getPath('userData');
  // Garante a criação física da pasta pai do Electron antes da subpasta
  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }
  const folder = path.join(baseDir, 'Backups');
  if (!fs.existsSync(folder)) {
    fs.mkdirSync(folder, { recursive: true });
  }
  return folder;
}

// Executa a cópia física e gerencia a regra de retenção dos últimos 30 arquivos
function realizarBackupAutomatico(sufixo = 'auto') {
  const mainFile = getDataFile();
  if (!fs.existsSync(mainFile) || !isValidJson(mainFile)) return;

  try {
    const folder = getBackupFolder();
    const agora = new Date();
    const timestamp =
      agora.getFullYear() +
      String(agora.getMonth() + 1).padStart(2, '0') +
      String(agora.getDate()).padStart(2, '0') +
      '_' +
      String(agora.getHours()).padStart(2, '0') +
      String(agora.getMinutes()).padStart(2, '0') +
      String(agora.getSeconds()).padStart(2, '0');

    const backupPath = path.join(folder, `backup_${sufixo}_${timestamp}.json`);
    fs.copyFileSync(mainFile, backupPath);

    // Regra de Retenção Rígida: Filtra, ordena e remove excedentes mantendo no máximo 30 arquivos
    const arquivos = fs
      .readdirSync(folder)
      .filter((arq) => arq.startsWith('backup_') && arq.endsWith('.json'))
      .map((arq) => ({
        name: arq,
        time: fs.statSync(path.join(folder, arq)).mtime.getTime(),
      }))
      .sort((a, b) => a.time - b.time);

    while (arquivos.length > 30) {
      const maisAntigo = arquivos.shift();
      fs.unlinkSync(path.join(folder, maisAntigo.name));
    }
  } catch (e) {
    console.error('Falha na execução do backup em segundo plano:', e);
  }
}

function getDataFile() {
  return path.join(app.getPath('userData'), 'checklist-data.json');
}

// Função auxiliar de validação sintática do JSON
const isValidJson = (filePath) => {
  try {
    if (!fs.existsSync(filePath)) return false;
    const content = fs.readFileSync(filePath, 'utf-8').trim();
    if (!content) return false;
    JSON.parse(content);
    return true;
  } catch {
    return false;
  }
};

function createWindow() {
  win = new BrowserWindow({
    width: 380,
    height: 600,
    minWidth: 320,
    minHeight: 460,
    resizable: true,
    maximizable: false,
    minimizable: true,
    alwaysOnTop: false,
    frame: false,
    transparent: false,
    title: 'Checklist Diário',
    backgroundColor: '#FFF3B0',
    icon: path.join(__dirname, 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Intercepta e congela qualquer encerramento nativo ou disparado por UI
  win.on('close', (e) => {
    if (!isReadyToClose) {
      e.preventDefault(); // Trava a destruição da instância da janela
      win.webContents.send('app-close-requested'); // Envia o pedido de salvamento ao Renderer
    }
  });

  win.loadFile('index.html');

  Menu.setApplicationMenu(null);
}

// ==========================================
// CICLO DE VIDA DO APLICATIVO
// ==========================================

app.whenReady().then(() => {
  createWindow();

  // Requisito: Backup instantâneo disparado ao iniciar a aplicação
  realizarBackupAutomatico('startup');

  // Requisito: Agendamento automático cíclico a cada 4 horas (4 * 60 * 60 * 1000 ms)
  intervaloBackup = setInterval(() => {
    realizarBackupAutomatico('auto');
  }, 14400000);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (intervaloBackup) clearInterval(intervaloBackup); // Destrói o timer da memória
  if (process.platform !== 'darwin') app.quit();
});

// ==========================================
// CANAIS DE COMUNICAÇÃO IPC
// ==========================================

// Resposta do Handshake IPC: Libera e destrói de forma definitiva a janela
ipcMain.on('app-close-confirmed', () => {
  isReadyToClose = true; // Desbloqueia o encerramento real
  if (win && !win.isDestroyed()) {
    win.close(); // Executa a destruição limpa da janela
  }
});

ipcMain.handle('close-app', () => {
  if (win && !win.isDestroyed()) {
    win.close(); // Direciona o clique da UI para o fluxo de intercepção no evento 'close'
  }
});

ipcMain.handle('toggle-pin', (event, pinned) => {
  win.setAlwaysOnTop(pinned, 'screen-saver');
  return win.isAlwaysOnTop();
});

ipcMain.handle('minimize', () => {
  win.minimize();
});

ipcMain.handle('toggle-autostart', (event, enable) => {
  app.setLoginItemSettings({ openAtLogin: enable, path: app.getPath('exe') });
  return app.getLoginItemSettings().openAtLogin;
});

ipcMain.handle('get-autostart', () => {
  return app.getLoginItemSettings().openAtLogin;
});

ipcMain.handle('load-data', () => {
  const mainFile = getDataFile();
  const backupFile = mainFile + '.bak';

  try {
    // 1. Cenário Ideal: Arquivo principal íntegro
    if (isValidJson(mainFile)) {
      return JSON.parse(fs.readFileSync(mainFile, 'utf-8'));
    }

    // 2. Recuperação Pós-Falha: Recorre ao espelho .bak se o principal falhar
    if (isValidJson(backupFile)) {
      const backupContent = fs.readFileSync(backupFile, 'utf-8');
      fs.writeFileSync(mainFile, backupContent, 'utf-8'); // Repara o principal
      return JSON.parse(backupContent);
    }

    // 3. Bloqueio de Sobrescrita Destrutiva: Se ambos falharem, isola os arquivos corrompidos
    if (fs.existsSync(mainFile)) {
      const timestamp = Date.now();
      fs.renameSync(mainFile, `${mainFile}.${timestamp}.corrupted`);
      if (fs.existsSync(backupFile)) {
        fs.renameSync(backupFile, `${backupFile}.${timestamp}.corrupted`);
      }
      return { _erroCriticoIntegridade: true };
    }
  } catch (e) {
    console.error('Erro crítico na carga de persistência:', e);
  }
  return {};
});

ipcMain.handle('save-data', (event, data) => {
  const mainFile = getDataFile();
  const tmpFile = mainFile + '.tmp';
  const backupFile = mainFile + '.bak';

  try {
    const stringifiedData = JSON.stringify(data, null, 2);

    // 1. Escrita isolada no arquivo temporário
    fs.writeFileSync(tmpFile, stringifiedData, 'utf-8');

    // 2. Validação obrigatória pós-gravação
    JSON.parse(fs.readFileSync(tmpFile, 'utf-8'));

    // 3. Atualiza o espelho de segurança (.bak) se o principal atual for válido
    if (fs.existsSync(mainFile) && isValidJson(mainFile)) {
      fs.copyFileSync(mainFile, backupFile);
    }

    // 4. Substituição Atômica robusta compatível com Windows (NTFS)
    if (fs.existsSync(mainFile)) {
      fs.unlinkSync(mainFile);
    }
    fs.renameSync(tmpFile, mainFile);
    return true;
  } catch (e) {
    console.error('Erro no salvamento atômico:', e);
    if (fs.existsSync(tmpFile)) {
      try {
        fs.unlinkSync(tmpFile);
      } catch {}
    }
    return false;
  }
});

ipcMain.handle('export-xlsx', async (event, buffer) => {
  const { filePath } = await dialog.showSaveDialog(win, {
    title: 'Exportar Planilha Excel',
    defaultPath: path.join(app.getPath('downloads'), 'Checklist_Tarefas.xlsx'),
    filters: [{ name: 'Arquivos Excel (*.xlsx)', extensions: ['xlsx'] }],
  });
  if (filePath) {
    try {
      fs.writeFileSync(filePath, Buffer.from(buffer));
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }
  return { success: false };
});

ipcMain.handle('export-csv', async (event, content) => {
  const { filePath } = await dialog.showSaveDialog(win, {
    title: 'Exportar Arquivo CSV',
    defaultPath: path.join(app.getPath('downloads'), 'Checklist_Tarefas.csv'),
    filters: [{ name: 'Arquivos CSV (*.csv)', extensions: ['csv'] }],
  });
  if (filePath) {
    try {
      fs.writeFileSync(filePath, '\ufeff' + content, 'utf-8');
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }
  return { success: false };
});

// Requisito: Canal preparado para efetuar backup preventivo antes de qualquer futura restauração
ipcMain.handle('backup-pre-restauracao', () => {
  realizarBackupAutomatico('prerestore');
  return true;
});

// Requisito: Preparação de infraestrutura para futura interface listar os pontos disponíveis
ipcMain.handle('listar-backups', () => {
  try {
    const folder = getBackupFolder();
    return fs
      .readdirSync(folder)
      .filter((arq) => arq.startsWith('backup_') && arq.endsWith('.json'))
      .sort()
      .reverse(); // Retorna os mais recentes no topo
  } catch {
    return [];
  }
});
