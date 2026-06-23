import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  method?: string;
  path?: string;
  status_code?: number;
  duration_ms?: number;
  message?: string;
  [key: string]: unknown;
}

@Injectable()
export class LoggerService implements NestLoggerService {
  log(message: string, context?: string): void {
    this.emit('info', message, context);
  }

  error(message: string, trace?: string, context?: string): void {
    this.emit('error', message, context, { trace });
  }

  warn(message: string, context?: string): void {
    this.emit('warn', message, context);
  }

  debug(message: string, context?: string): void {
    this.emit('debug', message, context);
  }

  verbose(message: string, context?: string): void {
    this.emit('debug', message, context);
  }

  logStructured(level: LogLevel, message: string, extra: Record<string, unknown>): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...extra,
    };
    process.stdout.write(JSON.stringify(entry) + '\n');
  }

  logRequest(entry: Omit<LogEntry, 'timestamp'>): void {
    const output = {
      timestamp: new Date().toISOString(),
      ...entry,
    };
    process.stdout.write(JSON.stringify(output) + '\n');
  }

  private emit(
    level: LogLevel,
    message: string,
    context?: string,
    extra?: Record<string, unknown>,
  ): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...(context ? { context } : {}),
      ...(extra || {}),
    };
    process.stdout.write(JSON.stringify(entry) + '\n');
  }
}
