import { contextBridge, ipcRenderer } from 'electron';
import type {
  DbConnectParams,
  DbQueryParams,
  HistoryEntry,
  SqlFile,
  SqlFolder
} from './ipc';

const api = {
  connect: (params: DbConnectParams) => ipcRenderer.invoke('db.connect', params),
  query: (params: DbQueryParams) => ipcRenderer.invoke('db.query', params),
  historyList: () => ipcRenderer.invoke('history.list') as Promise<HistoryEntry[]>,
  profileList: () =>
    ipcRenderer.invoke('profile.list') as Promise<DbConnectParams[]>,
  listTables: (schema: string) =>
    ipcRenderer.invoke('meta.tables', { schema }) as Promise<string[]>,
  openSqlFolder: (dir?: string) =>
    ipcRenderer.invoke('fs.openFolder', dir) as Promise<SqlFolder>,
  onOpenConnect: (callback: () => void) => {
    const wrapped = () => callback();
    ipcRenderer.on('open-connect', wrapped);
    return () => ipcRenderer.off('open-connect', wrapped);
  },
  logError: (msg: string) => {
    ipcRenderer.send('renderer.error', msg);
  }
};

contextBridge.exposeInMainWorld('pgace', api);

export type PgAceAPI = typeof api;

declare global {
  interface Window {
    pgace: PgAceAPI;
  }
}
