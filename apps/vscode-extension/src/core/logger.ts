import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { getAppLogFilePath } from '../constants';

let logFilePath = '';

enum LogLevel {
  Debug = 'DEBUG',
  Info = 'INFO',
  Warning = 'WARNING',
  Error = 'ERROR',
}

export function initializeLogging(): void {
  logFilePath = getAppLogFilePath();
  fs.mkdirSync(path.dirname(logFilePath), { recursive: true });
  fs.writeFileSync(logFilePath, '');
}

function writeLog(level: LogLevel, message: string): void {
  if (!logFilePath) {
    return;
  }

  try {
    fs.appendFileSync(logFilePath, `[${new Date().toISOString()}] [${level}] ${message}\n`);
  } catch {}
}

export const logger = {
  debug(message: string): void {
    writeLog(LogLevel.Debug, message);
  },
  info(message: string): void {
    writeLog(LogLevel.Info, message);
  },
  warning(message: string): void {
    writeLog(LogLevel.Warning, message);
  },
  error(message: string): void {
    writeLog(LogLevel.Error, message);
  },
  log(message: string): void {
    writeLog(LogLevel.Info, message);
  },
};

export async function showLogs(preserveFocus?: boolean): Promise<void> {
  if (!logFilePath) {
    return;
  }

  const document = await vscode.workspace.openTextDocument(logFilePath);
  await vscode.window.showTextDocument(document, { preview: false, preserveFocus });
}

export function getLogFilePath(): string {
  return logFilePath;
}

export function formatLogError(error: unknown): string {
  if (error instanceof Error) {
    return error.stack ?? error.message;
  }

  return String(error);
}
