import { app, ipcMain } from "electron";
import setMenu from "./AppMenuManager.js";
import { log } from "./util.js";
import WindowManager from "./WindowManager.js";
import { setupCredentialsHandlers, cleanupCredentialsHandlers } from "./secureStorage.js";

import { getWindowManager, setWindowManager } from "./WindowManagerInstance.js";
import { setupTaskbar } from "./MSWinTaskbarManager.js";

// Modern way to handle single instance lock
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  let windowManager: WindowManager | null = null;
  
  // Fires when someone tries to run a second instance.
  app.on("second-instance", (event: Electron.Event, argv: string[], workingDirectory: string, additionalData: any) => {
    log("Second instance detected. parameters:", {
      event,
      argv,
      workingDirectory,
      additionalData
    });

    // If cli flag `--new-window` is passed, open a new window
    if (argv.includes("--new-window") && windowManager != null) {
      log("New window requested. Opening a new window.");
      windowManager.openNewWindow();
      return;
    }

    /*
    // If CLI flag `--open-url` is passed, open the given URL in a new window
    const openUrlIndex = argv.indexOf("--open-url");
    if (openUrlIndex !== -1 && windowManager != null) {
      const url = argv[openUrlIndex + 1];
      log("New window w/ URL requested. Opening URL:", url);
      windowManager.openNewWindow(url);
      return;
    }
    */

    // If no flags are passed, focus the first window
    if (windowManager != null) {
      log("No valid flags from Second instance, focusing the first window");
      windowManager.focusFirstWindow();
    }else {
      // TODO: This error message needs to be better. Right now it's too specific to focusing the first window.
      log("Critical Error! No window manager instance available to focus the first window.");
    }
  });

  // Enable electron-debug
  import("electron-debug").then(({ default: electronDebug }) => {
    electronDebug({ showDevTools: false });
  }).catch(err => {
    log("Error loading electron-debug:", err);
  });

  // Wait for app to be ready before creating windows
  app.whenReady().then(() => {
    // Set up secure storage handlers
    setupCredentialsHandlers();

    // Set up the Windows taskbar jump list
    setupTaskbar();
    
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
