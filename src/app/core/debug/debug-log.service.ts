import { Injectable, signal } from '@angular/core';

export type LogLevel = 'info' | 'success' | 'error';

export interface LogEntry {
  ts: string;
  level: LogLevel;
  msg: string;
}

const MAX_ENTRIES = 50;

@Injectable({ providedIn: 'root' })
export class DebugLogService {
  private readonly _entries = signal<LogEntry[]>([]);
  readonly entries = this._entries.asReadonly();

  log(level: LogLevel, msg: string): void {
    const entry: LogEntry = {
      ts: new Date().toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      level,
      msg,
    };
    this._entries.update(list => [entry, ...list].slice(0, MAX_ENTRIES));
  }

  info(msg: string): void { this.log('info', msg); }
  success(msg: string): void { this.log('success', msg); }
  error(msg: string): void { this.log('error', msg); }

  clear(): void { this._entries.set([]); }
}
