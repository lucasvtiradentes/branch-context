import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { getAppLogFilePath } from '../constants';

enum LogLevel {
  Debug = 'DEBUG',
  Info = 'INFO',
  Warning = 'WARNING',
  Error = 'ERROR',
}

class ExtensionLogger {
  private logFilePath = '';

  initialize(): void {
    this.logFilePath = getAppLogFilePath();
    fs.mkdirSync(path.dirname(this.logFilePath), { recursive: true });
    fs.writeFileSync(this.logFilePath, '');
  }

  debug(message: string): void {
    this.write(LogLevel.Debug, message);
  }

  info(message: string): void {
    this.write(LogLevel.Info, message);
  }

  warning(message: string): void {
    this.write(LogLevel.Warning, message);
  }

  error(message: string): void {
    this.write(LogLevel.Error, message);
  }

  log(message: string): void {
    this.write(LogLevel.Info, message);
  }

  async showLogs(preserveFocus?: boolean): Promise<void> {
    if (!this.logFilePath) {
      return;
    }

    const document = await vscode.workspace.openTextDocument(this.logFilePath);
    await vscode.window.showTextDocument(document, { preview: false, preserveFocus });
  }

  getLogFilePath(): string {
    return this.logFilePath;
  }

  formatError(error: unknown): string {
    if (error instanceof Error) {
      return error.stack ?? error.message;
    }

    return String(error);
  }

  private write(level: LogLevel, message: string): void {
    if (!this.logFilePath) {
      return;
    }

    try {
      fs.appendFileSync(this.logFilePath, `[${new Date().toISOString()}] [${level}] ${message}\n`);
    } catch {}
  }
}

export const logger = new ExtensionLogger();
