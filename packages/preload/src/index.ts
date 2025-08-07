import { contextBridge, ipcRenderer } from 'electron';
import type {
  DbConnectParams,
  DbQueryParams,
  HistoryEntry,
  SqlFile
} from './ipc';

const api = {
  connect: (params: DbConnectParams) => ipcRenderer.invoke('db.connect', params),
  query: (params: DbQueryParams) => ipcRenderer.invoke('db.query', params),
  historyList: () => ipcRenderer.invoke('history.list') as Promise<HistoryEntry[]>,
  profileList: () =>
    ipcRenderer.invoke('profile.list') as Promise<DbConnectParams[]>,
  listTables: (schema: string) =>
    ipcRenderer.invoke('meta.tables', { schema }) as Promise<string[]>,
  openSqlFolder: () =>
    ipcRenderer.invoke('fs.openFolder') as Promise<SqlFile[]>
};

contextBridge.exposeInMainWorld('pgace', api);

export type PgAceAPI = typeof api;

declare global {
  interface Window {
    pgace: PgAceAPI;
  }
}
