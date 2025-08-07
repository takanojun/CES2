import { app, BrowserWindow, ipcMain, dialog, Menu } from 'electron';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import fs from 'node:fs/promises';
import { Client } from 'pg';
import type {
  DbConnectParams,
  DbQueryParams,
  HistoryEntry,
  SqlFile,
  SqlFolder
} from './ipc';

let mainWindow: BrowserWindow | null = null;
let db: any = null;

const APPDATA_DIR = path.join(app.getAppPath(), 'appdata');
const HISTORY_FILE = path.join(APPDATA_DIR, 'history.log');
const HISTORY_MAX = 500;
const CONFIG_FILE = path.join(APPDATA_DIR, 'config.json');

interface Config {
  profiles: DbConnectParams[];
}

const loadConfig = async (): Promise<Config> => {
  try {
    const data = await fs.readFile(CONFIG_FILE, 'utf8');
    return JSON.parse(data) as Config;
  } catch {
    return { profiles: [] };
  }
};

const saveConfig = async (cfg: Config) => {
  await fs.mkdir(APPDATA_DIR, { recursive: true });
  await fs.writeFile(CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf8');
};

const saveProfile = async (p: DbConnectParams) => {
  const cfg = await loadConfig();
  const idx = cfg.profiles.findIndex(
    (x) =>
      x.host === p.host &&
      x.port === p.port &&
      x.database === p.database &&
      x.user === p.user
  );
  if (idx >= 0) cfg.profiles[idx] = p;
  else cfg.profiles.push(p);
  await saveConfig(cfg);
};

const appendHistory = async (sql: string) => {
  const entry: HistoryEntry = { timestamp: new Date().toISOString(), sql };
  await fs.mkdir(APPDATA_DIR, { recursive: true });
  await fs.appendFile(HISTORY_FILE, JSON.stringify(entry) + '\n', 'utf8');
  const data = await fs.readFile(HISTORY_FILE, 'utf8');
  const lines = data.trimEnd().split('\n');
  if (lines.length > HISTORY_MAX) {
    const latest = lines.slice(-HISTORY_MAX);
    await fs.writeFile(HISTORY_FILE, latest.join('\n') + '\n', 'utf8');
  }
};

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    webPreferences: {
      // __dirname points to packages/main/dist when compiled
      // move up to the packages directory to access the preload bundle
      preload: path.join(__dirname, '../../preload/dist/index.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false
    }
  });

  if (app.isPackaged) {
    // load the built renderer HTML from the renderer's dist directory
    const fileUrl = pathToFileURL(
      path.join(__dirname, '../../renderer/dist/index.html')
    ).toString();
    mainWindow.loadURL(fileUrl);
  } else {
    // during development, load the Vite dev server
    mainWindow.loadURL('http://localhost:5173');
  }

  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Connect...',
          click: () => {
            mainWindow?.webContents.send('open-connect');
          }
        }
      ]
    }
  ];
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);

  mainWindow.webContents.once('did-finish-load', () => {
    mainWindow?.webContents.send('open-connect');
  });
};

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('db.connect', async (_event, params: DbConnectParams) => {
  if (db) {
    await db.end().catch(() => undefined);
  }
  db = new Client({
    host: params.host,
    port: params.port,
    database: params.database,
    user: params.user,
    password: params.password
  });
  await db.connect();
  await saveProfile(params);
  return 'connected';
});

ipcMain.handle('db.query', async (_event, params: DbQueryParams) => {
  if (!db) throw new Error('not connected');
  const res = await db.query(params.sql);
  await appendHistory(params.sql);
  return res.rows;
});

ipcMain.handle('profile.list', async () => {
  const cfg = await loadConfig();
  return cfg.profiles;
});

ipcMain.handle('history.list', async () => {
  try {
    const data = await fs.readFile(HISTORY_FILE, 'utf8');
    return data
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  } catch {
    return [];
  }
});
ipcMain.handle('meta.tables', async (_event, params: { schema: string }) => {
  if (!db) throw new Error('not connected');
  const res = await db.query(
    'SELECT table_name FROM information_schema.tables WHERE table_schema = $1 ORDER BY table_name',
    [params.schema]
  );
  return res.rows.map((r: any) => r.table_name as string);
});
ipcMain.handle('fs.openFolder', async (_event, dir?: string): Promise<SqlFolder> => {
  const readDir = async (d: string): Promise<SqlFolder> => {
    const entries = await fs.readdir(d, { withFileTypes: true });
    const files: SqlFile[] = await Promise.all(
      entries
        .filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.sql'))
        .map(async (e) => {
          const p = path.join(d, e.name);
          const content = await fs.readFile(p, 'utf8');
          return { name: e.name, content };
        })
    );
    return { dir: d, files };
  };

  if (dir) {
    return readDir(dir);
  }

  const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
  if (result.canceled || result.filePaths.length === 0) return { dir: '', files: [] };
  const d = result.filePaths[0];
  return readDir(d);
});
