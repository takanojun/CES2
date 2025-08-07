export type IpcChannel =
  | 'db.connect'
  | 'db.query'
  | 'history.list'
  | 'profile.list'
  | 'meta.tables'
  | 'fs.openFolder';

export interface DbConnectParams {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

export interface DbQueryParams {
  sql: string;
}

export interface HistoryEntry {
  timestamp: string;
  sql: string;
}

export interface SqlFile {
  name: string;
  content: string;
}

export interface SqlFolder {
  dir: string;
  files: SqlFile[];
}
