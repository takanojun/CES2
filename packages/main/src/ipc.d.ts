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
