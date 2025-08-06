import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import { Client } from 'pg';
import type { DbConnectParams, DbQueryParams } from './ipc';

let mainWindow: BrowserWindow | null = null;
let db: any = null;

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
  return res.rows;
});
