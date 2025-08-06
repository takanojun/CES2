import type { PgAceAPI } from '../../preload/src';

declare global {
  interface Window {
    pgace: PgAceAPI;
  }
}

export {};
