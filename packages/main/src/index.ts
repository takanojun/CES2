import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';
import { Client } from 'pg';
import type { DbConnectParams, DbQueryParams, HistoryEntry } from './ipc';

let mainWindow: BrowserWindow | null = null;
let db: any = null;

const APPDATA_DIR = path.join(app.getAppPath(), 'appdata');
const HISTORY_FILE = path.join(APPDATA_DIR, 'history.log');
const HISTORY_MAX = 500;

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
      preload: path.join(__dirname, '../preload/dist/index.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false
    }
  });

  const url = process.env.VITE_DEV_SERVER_URL ||
    `file://${path.join(__dirname, '../renderer/index.html')}`;
  mainWindow.loadURL(url);
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
  return 'connected';
});

ipcMain.handle('db.query', async (_event, params: DbQueryParams) => {
  if (!db) throw new Error('not connected');
  const res = await db.query(params.sql);
  await appendHistory(params.sql);
  return res.rows;
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
