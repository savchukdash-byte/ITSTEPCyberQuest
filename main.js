// CyberQuest — головний процес Electron: режим кіоску + прихований вихід для організатора.
const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const fs = require('fs');
const path = require('path');

const DEV = process.env.CQ_DEV === '1';
let quitting = false;
let win;

// config.json і pack.js можна класти ПОРУЧ з exe (portable) — без перебудови гри.
const extDir = process.env.PORTABLE_EXECUTABLE_DIR || (app.isPackaged ? path.dirname(app.getPath('exe')) : __dirname);

function readConfig() {
  const def = { exitPassword: 'itstep2026' };
  try { return { ...def, ...JSON.parse(fs.readFileSync(path.join(extDir, 'config.json'), 'utf8')) }; }
  catch { return def; }
}

function readExternalPack() {
  try { return fs.readFileSync(path.join(extDir, 'pack.js'), 'utf8'); } catch { return null; }
}

if (!app.requestSingleInstanceLock()) app.quit();

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  win = new BrowserWindow({
    fullscreen: !DEV,
    kiosk: !DEV,
    frame: DEV,
    alwaysOnTop: !DEV,
    minimizable: DEV,
    maximizable: DEV,
    resizable: DEV,
    closable: DEV,
    width: 1280, height: 720,
    backgroundColor: '#0B1020',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      devTools: DEV,
      autoplayPolicy: 'no-user-gesture-required',
    },
  });
  if (!DEV) win.setAlwaysOnTop(true, 'screen-saver');
  win.loadFile(path.join(__dirname, 'src', 'index.html'), DEV ? { query: { dev: '1' } } : {});

  if (!DEV) {
    win.on('close', (e) => { if (!quitting) e.preventDefault(); });
    win.on('minimize', () => win.restore());
    win.on('blur', () => setTimeout(() => { if (!quitting && win) win.focus(); }, 50));
    win.webContents.on('before-input-event', (e, i) => {
      const k = (i.key || '').toLowerCase();
      const block =
        k === 'f11' || k === 'f12' || k === 'f5' || k === 'escape' || k === 'f4' && i.alt ||
        (i.control && ['w', 'r', 'q', 'n', 'p'].includes(k)) ||
        (i.control && i.shift) || (i.alt && ['arrowleft', 'arrowright'].includes(k));
      if (block) e.preventDefault();
    });
  }
});

ipcMain.handle('quit', () => { quitting = true; app.quit(); return true; });
ipcMain.on('pack', (e) => { e.returnValue = readExternalPack(); });

app.on('window-all-closed', () => app.quit());
