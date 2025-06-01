import isDev from 'electron-is-dev';
import electronLog from 'electron-log';

export { isDev };

// Set up logging based on environment
let _log: (...args: any[]) => void;

if (isDev) {


  // Optional, initialize the logger for any renderer process
  electronLog.initialize();

  // Disable file logging in development mode
  electronLog.transports.file.level = false;

  // Set the console log level to "info" in development mode
  electronLog.transports.console.level = 'info';

  // Setup console log formatting
  // electronLog.transports.console.format = '[{y}-{m}-{d} {h}:{i}:{s}] [{level}] {text}';
  // electronLog.transports.console.format = '[%c{h}:{i}:{s}.{ms}%c] [{processType}] [{level}] > {text}';
  electronLog.transports.console.format = '[%c{h}:{i}:{s}.{ms}%c] [{processType}] > {text}';

  // Override `console.log` to use electron-log
  // console.log = electronLog.log.bind(electronLog);
  console.log = electronLog.log;

  // Set _log to use electron-log
  _log = electronLog.info.bind(electronLog);
  
} else {
  _log = electronLog.info.bind(electronLog);
}

export function log(...args: any[]): void {
  _log(...args);
}

export function loggerType(): string {
  return isDev ? "development" : "production";
}
