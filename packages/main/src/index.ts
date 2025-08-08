import { app, BrowserWindow, ipcMain, dialog, Menu, crashReporter } from 'electron';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import fs from 'node:fs/promises';
import pg from 'pg';
type PgClient = InstanceType<typeof pg.Client>;
const { Client: PgClientCtor } = pg;
import type {
  DbConnectParams,
  DbQueryParams,
  HistoryEntry,
  SqlFile,
  SqlFolder
} from './ipc';

let mainWindow: BrowserWindow | null = null;
let db: PgClient | null = null;
let gpuCrashCount = 0;
const MAX_GPU_RELOADS = 3;

const APPDATA_DIR = path.join(app.getAppPath(), 'appdata');
const HISTORY_FILE = path.join(APPDATA_DIR, 'history.log');
const HISTORY_MAX = 500;
const CONFIG_FILE = path.join(APPDATA_DIR, 'config.json');
const ERROR_LOG = path.join(APPDATA_DIR, 'error.log');
const CRASH_DIR = path.join(APPDATA_DIR, 'crashes');
const ELECTRON_LOG = path.join(APPDATA_DIR, 'electron.log');

app.commandLine.appendSwitch('enable-logging');
app.commandLine.appendSwitch('log-file', ELECTRON_LOG);

app.setPath('crashDumps', CRASH_DIR);
crashReporter.start({ submitURL: '', uploadToServer: false });

const writeLog = async (line: string) => {
  try {
    await fs.mkdir(APPDATA_DIR, { recursive: true });
    await fs.appendFile(ERROR_LOG, line + '\n', 'utf8');
  } catch {
    // ignore logging errors
  }
  console.error(line);
};

const logInfo = async (msg: string) => {
  await writeLog(`${new Date().toISOString()} ${msg}`);
};

const logError = async (msg: string, err?: unknown) => {
  const detail =
    err instanceof Error
      ? err.stack ?? err.message
      : err !== undefined
      ? JSON.stringify(err)
      : '';
  await writeLog(
    `${new Date().toISOString()} ${msg}${detail ? ` ${detail}` : ''}`
  );
};

process.on('uncaughtException', (err) => {
  void logError('uncaughtException', err);
});
process.on('unhandledRejection', (reason) => {
  void logError('unhandledRejection', reason);
});

app.on('child-process-gone', async (_event, details) => {
  await logError('child-process-gone', details);
  if (details.type === 'GPU') {
    gpuCrashCount += 1;
    if (gpuCrashCount <= MAX_GPU_RELOADS) {
      mainWindow?.reload();
    } else {
      dialog.showErrorBox(
        'GPU process crashed',
        'GPUプロセスが繰り返しクラッシュしました。アプリケーションを再起動してください。'
      );
    }
  }
});

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

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    void logError('render-process-gone', details);
    mainWindow?.reload();
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

app.whenReady().then(async () => {
  try {
    const info = await app.getGPUInfo('basic');
    await logInfo(`gpu.info ${JSON.stringify(info)}`);
  } catch (e) {
    await logError('gpu.info error', e);
  }
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.on('renderer.error', (_event, msg: string) => {
  void logError('renderer.error', msg);
});

ipcMain.handle('db.connect', async (_event, params: DbConnectParams) => {
  if (db) {
    await db.end().catch(() => undefined);
  }
  db = new PgClientCtor({
    host: params.host,
    port: params.port,
    database: params.database,
    user: params.user,
    password: params.password
  });
  try {
    await logInfo(
      `db.connect start host=${params.host} port=${params.port} db=${params.database}`
    );
    await db.connect();
    await logInfo('db.connect success');
  } catch (e) {
    await logError('db.connect error', e);
    throw e;
  }
  await saveProfile(params);
  return 'connected';
});

ipcMain.handle('db.query', async (_event, params: DbQueryParams) => {
  if (!db) throw new Error('not connected');
  await logInfo(`db.query start sql=${params.sql}`);
  const start = Date.now();
  try {
    const res = await db.query(params.sql);
    const duration = Date.now() - start;
    const rows = res.rows;
    await logInfo(`db.query success rows=${rows.length} duration=${duration}ms`);
    await appendHistory(params.sql);
    return rows;
  } catch (e) {
    await logError('db.query error', e);
    throw e;
  }
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
  if (!db) return [];
  try {
    await logInfo(`meta.tables start schema=${params.schema}`);
    const res = await db.query(
      'SELECT table_name FROM information_schema.tables WHERE table_schema = $1 ORDER BY table_name',
      [params.schema]
    );
    const rows = res.rows.map((r: any) => r.table_name as string);
    await logInfo(`meta.tables success rows=${rows.length}`);
    return rows;
  } catch (e) {
    await logError('meta.tables error', e);
    return [];
  }
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
