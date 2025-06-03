// import { autoUpdater } from "electron-updater";
import pkg from 'electron-updater';
const { autoUpdater } = pkg;

import electronLog from "electron-log";

// TODO: autoUpdater results in the App `before-quit` event firing AFTER the windows `close` & `closed` events.
//       This breaks the app's ability to save the state of the windows before quitting.

export default class AppUpdater {
  constructor() {
    // Configure logging
    electronLog.transports.file.level = "debug";

    // Set the logger
    autoUpdater.logger = electronLog;
    
    // Check for updates
    autoUpdater.checkForUpdatesAndNotify().catch(err => {
      electronLog.error('Error checking for updates:', err);
    });
  }
}