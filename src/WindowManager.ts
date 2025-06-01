import { app, BrowserWindow, ipcMain } from "electron";
import * as path from "path";
import AppUpdater from "./AppUpdater";
import { WebContentsSignal, WindowEvent } from "./electronEventSignals";
import { DEFAULT_URL, DEFAULT_WINDOW_SIZE, StateManager, WindowItem } from "./StateManager";
import { log } from "./util";

export const WINDOW_NAVIGATED = "windowNavigated";

/* ----- Configuration ----- */

// If true, the window layouts will be reset to the default state when all windows are closed
const RESET_WINDOWS_ON_QUIT = false;

/* ----- End Configuration ----- */

export default class WindowManager {
  // TODO: Set back to private
  public stateManager = new StateManager();
  private windows: Array<Electron.BrowserWindow> = [];

  constructor() {
    /*
    Emitted when all windows have been closed.

    If you do not subscribe to this event and all windows are closed, the default behavior is to quit the app;
      however, if you subscribe, you control whether the app quits or not. 
    If the user pressed Cmd + Q, or the developer called app.quit(), Electron will first try to close all the windows and then emit the will-quit event, 
      and in this case the window-all-closed event would not be emitted.
    */
    app.on("window-all-closed", () => {
      if (RESET_WINDOWS_ON_QUIT) {
        this.stateManager.resetSavedWindowsState();  // restore default set of windows

      }
      
      // On macOS it is common for applications and their menu bar
      // to stay active until the user quits explicitly with Cmd + Q
      if (process.platform === "darwin") {
        // reopen initial window
        this.openWindows();
      } else {
        app.quit();
      }
    });

    /*
    Emitted before the application starts closing its windows. Calling event.preventDefault() will prevent the default behavior, which is terminating the application.
    Note: If application quit was initiated by autoUpdater.quitAndInstall(), then before-quit is emitted after emitting close event on all windows and closing them.
    Note: On Windows, this event will not be emitted if the app is closed due to a shutdown/restart of the system or a user logout.
    */
    app.on("before-quit", () => {
      // Save the state of all windows before quitting
      log("[WindowManager] app.on `before-quit` event fired");
    });

    /*
    Emitted when the application is quitting.
    Note: On Windows, this event will not be emitted if the app is closed due to a shutdown/restart of the system or a user logout.
    */
    app.on("quit", () => {
      /* -- Debug Calls -- */
      const windowsState = this.getWindowsJSON();
      log("[WindowManager] app.on `quit` event fired. Final Window State JSON:", windowsState);
    });

    /*
    Emitted when all windows have been closed and the application will quit. Calling event.preventDefault() will prevent the default behavior, which is terminating the application.
    See the description of the window-all-closed event for the differences between the will-quit and window-all-closed events.
    Note: On Windows, this event will not be emitted if the app is closed due to a shutdown/restart of the system or a user logout.
    */
    app.on("will-quit", () => {
      log("[WindowManager] app.on `will-quit` event fired");
    });
  }

  /**
   * Transfers the current state of the window to the descriptor object.
   * @param window The Electron BrowserWindow instance to save the state of.
   * @param descriptor The descriptor object to save the state to.
   */
  private static saveWindowState(window: Electron.BrowserWindow, descriptor: WindowItem): void {
    if (window.isMaximized()) {
      delete descriptor.width;
      delete descriptor.height;
      delete descriptor.x;
      delete descriptor.y;
    } else {
      const bounds = window.getBounds();
      descriptor.width = bounds.width;
      descriptor.height = bounds.height;
      descriptor.x = bounds.x;
      descriptor.y = bounds.y;
    }
    descriptor.maximized = window.isMaximized();
    descriptor.title = window.getTitle();

    const url = window.webContents.getURL();
    if (!isUrlInvalid(url)) {
      descriptor.url = url; 
    }
    console.log("[WindowManager] Saved state for window:", window.id);
  }

  private registerWindowEventHandlers(window: Electron.BrowserWindow, descriptor: WindowItem): void {

    /*
    Emitted when the window is going to be closed. It's emitted before the beforeunload and unload event of the DOM. Calling event.preventDefault() will cancel the close.
    Usually you would want to use the beforeunload handler to decide whether the window should be closed, which will also be called when the window is reloaded. 
    In Electron, returning any value other than undefined would cancel the close. For example: ...
    Note: There is a subtle difference between the behaviors of window.onbeforeunload = handler and window.addEventListener('beforeunload', handler). 
          It is recommended to always set the event.returnValue explicitly, instead of only returning a value, as the former works more consistently within Electron.
    */
    window.on("close", () => {
      log("[WindowManager] window.on `close` event fired for window:", window.id);
      WindowManager.saveWindowState(window, descriptor);
      this.stateManager.save(`Via WindowManager:window.on 'close' event for window: ${window.id}`);
    });


    window.on("closed", (event: WindowEvent) => {
      log("[WindowManager] window.on `closed` event fired. Removed window:", window.id);
      let index: number = -39;
      if (!event.sender) {
        index = this.windows.indexOf(window);
        // console.log("[WindowManager]     window.on 'closed' ->  Event.sender is null. Using window reference directly. Got Index:", index);
      } else {
        // console.log(`[WindowManager]     window.on 'closed' ->  Event.sender:`, event.sender);
        // console.log(`[WindowManager]     window.on 'closed' ->  Event:`, event);
        index = this.windows.indexOf(event.sender);
        // console.log("[WindowManager]     window.on 'closed' ->  Index of closed window:", index);
      }
      console.assert(index >= 0);
      this.windows.splice(index, 1);
    });

    window.on("app-command", (e, command) => {
      // navigate the window back when the user hits their mouse back button
      if (command === "browser-backward") {
        if (window.webContents.canGoBack()) {
          window.webContents.goBack();
        }
      } else if (command === "browser-forward") {
        if (window.webContents.canGoForward()) {
          window.webContents.goForward();
        }
      }
    });

    const webContents = window.webContents;
    new WebContentsSignal(webContents)
      .navigated((_event, url) => {
        // Pass the WebContents object directly as the first parameter
        ipcMain.emit(WINDOW_NAVIGATED, webContents, url);
        webContents.send("maybeUrlChanged", url);
        console.log("[navigated] Sent `maybeUrlChanged` event with URL:", url);
      })
      .navigatedInPage((_event, url) => {
        // Pass the WebContents object directly as the first parameter
        ipcMain.emit(WINDOW_NAVIGATED, webContents, url);
        webContents.send("maybeUrlChanged", url);
        console.log("[navigatedInPage] Sent `maybeUrlChanged` event with URL:", url);
      });

    // Setup Window Open Handler
    //   This handler is called when a *new* window is requested to be opened via an existing window's webContents.
    //   It enables you to intercept window.open() calls and modify the options used to create the new window.
    //   In our case, it is necessary so that when the user opens links in a new window, our preload script is loaded and we can save the state of the new window.
    // See: https://typeerror.org/docs/electron/api/web-contents#contentssetwindowopenhandlerhandler
    // TODO: Finish implementing this. The current code works, but I believe there are a bunch of edge cases that need to be handled.
    webContents.setWindowOpenHandler((details) => {
      log("[WindowManager] setWindowOpenHandler", details);
      const newDescriptor: WindowItem = {
        url: details.url,
        width: DEFAULT_WINDOW_SIZE.width,
        height: DEFAULT_WINDOW_SIZE.height
      };
      this.createNewWindow(newDescriptor);
      return { action: "deny" };
    });
  }

  /**
   * Creates a new window with the given URL or the default URL if none is provided.
   * The new window will have the default size and position.
   * @public
   * @param url
   */
  openNewWindow(url: string | undefined = undefined): void {
    const descriptor: WindowItem = {
      url: url || DEFAULT_URL,
      width: DEFAULT_WINDOW_SIZE.width,
      height: DEFAULT_WINDOW_SIZE.height
    };
    this.createNewWindow(descriptor);
  }


  /**
   * Creates a new window based on the provided descriptor.
   * If the URL is invalid, it will default to the `DEFAULT_URL`.
   * @param descriptor - The descriptor object containing the URL and optional size/position.
   */
  private createNewWindow(descriptor: WindowItem): void {
    if (isUrlInvalid(descriptor.url)) {
      // was error on load
      descriptor.url = DEFAULT_URL;
    }

    const options: Electron.BrowserWindowConstructorOptions = {
      // to avoid visible maximizing
      show: false,
      webPreferences: {
        preload: path.join(__dirname, "preload-src", "autoSignIn.js"),
        // preload: path.join(__dirname, "preload-src", "windowTitleUpdater.js"),
        // preload: path.join(__dirname, "preload-src", "preloadScriptLoader.js"),
        // In modern Electron, these security settings are recommended
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false,  // Set to false as sandbox might interfere with some features
        webSecurity: true,
        // devTools: false,
      },
      darkTheme: true,
      title: "Loading - Onshape Desktop"
    };

    let isMaximized = false;
    if (descriptor.width != null && descriptor.height != null) {
      options.width = descriptor.width;
      options.height = descriptor.height;
      isMaximized = false;
    }
    if (descriptor.x != null && descriptor.y != null) {
      options.x = descriptor.x;
      options.y = descriptor.y;
      isMaximized = false;
    }

    const window = new BrowserWindow(options);
    log("[WindowManager]", "Creating window `" + window.id + "`");
    if (isMaximized) {
      window.maximize();
    }
    
    window.loadURL(descriptor.url);
    // log("[WindowManager]", "Loading URL: " + descriptor.url + " in window `", window.id, "`");
    window.show();


    this.registerWindowEventHandlers(window, descriptor);
    this.windows.push(window);
  }

  /**
   * Opens all saved windows from the state manager.
   * If no saved windows are found, it resets the state and opens the default windows.
   */
  openWindows(): void {
    let descriptors = this.stateManager.getWindows();
    if (descriptors === null || descriptors.length === 0) {
      this.stateManager.resetSavedWindowsState();
      descriptors = this.stateManager.getWindows();
    }

    for (const descriptor of descriptors) {
      this.createNewWindow(descriptor);
    }

    new AppUpdater();
  }

  focusFirstWindow(): void {
    if (this.windows.length > 0) {
      const window = this.windows[0];
      if (window.isMinimized()) {
        window.restore();
      }
      window.focus();
    }
  }

  windowCount(): number {
    return this.windows.length;
  }

  /**
   * 
   * @returns A JSON string representing the current state of all windows.
   * @deprecated
   */
  getWindowsJSON(): string | undefined {
    const serializedData = this.stateManager.getWindowsJSON();
    return serializedData;
  }
}

function isUrlInvalid(url: string): boolean {
  return url == null || url.length === 0 || url === "about:blank";
}
