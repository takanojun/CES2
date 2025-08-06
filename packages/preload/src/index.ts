import { contextBridge, ipcRenderer } from 'electron';
import type { DbConnectParams, DbQueryParams, HistoryEntry } from './ipc';

const api = {
  connect: (params: DbConnectParams) => ipcRenderer.invoke('db.connect', params),
  query: (params: DbQueryParams) => ipcRenderer.invoke('db.query', params),
  historyList: () => ipcRenderer.invoke('history.list') as Promise<HistoryEntry[]>
};

contextBridge.exposeInMainWorld('pgace', api);

export type PgAceAPI = typeof api;

declare global {
  interface Window {
    pgace: PgAceAPI;
  }
}
