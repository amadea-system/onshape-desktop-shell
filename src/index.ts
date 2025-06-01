import { app, ipcMain } from "electron";
import setMenu from "./AppMenuManager";
import { log } from "./util";
import WindowManager from "./WindowManager";
import { setupCredentialsHandlers, cleanupCredentialsHandlers } from "./secureStorage";

import { getWindowManager, setWindowManager } from "./WindowManagerInstance";

// Modern way to handle single instance lock
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  let windowManager: WindowManager | null = null;
  
  // Someone tried to run a second instance, we should focus our window
  app.on("second-instance", () => {
    log("Second instance detected, focusing the first window");
    if (windowManager != null) {
      windowManager.focusFirstWindow();
    }
  });

  // Enable electron-debug
  require("electron-debug")();

  // Wait for app to be ready before creating windows
  app.whenReady().then(() => {
    // Set up secure storage handlers
    setupCredentialsHandlers();

    ipcMain.on("log.error", (_event: any, arg: any) => {
      log(arg);
    });

    windowManager = new WindowManager();
    setWindowManager(windowManager);

    setMenu("https://cad.onshape.com/documents");
    windowManager.openWindows();
  });

  // Clean up when app is about to quit
  app.on('before-quit', () => {
    cleanupCredentialsHandlers();
  });

  // Quit when all windows are closed, except on macOS
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });
}
