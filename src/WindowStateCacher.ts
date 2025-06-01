
import { BrowserWindow } from "electron";
import { WindowEvent } from "./electronEventSignals";
import { WindowItem } from "./StateManager";

/* ----- Configuration ----- */

const CLOSED_TIMEOUT = 1000; // Time in milliseconds to wait before considering a window to actually be closed.

/* ----- Classes ----- */

export class WindowStateCacher {
  private cachedStates: Array<CachedWindowState> = [];
  public lastClosedWindow: CachedWindowState | null = null;

  constructor() {
    // Initialize with default windows state
    console.log("[WindowStateCacher] Initialized with windows state:", this.cachedStates);
  }
    
  addNewWindow(window: BrowserWindow, descriptor: WindowItem): void {
    const windowId = window.id; // Get the window ID from the BrowserWindow instance
    const newWindowState: CachedWindowState = {
      descriptor,
      openedAt: new Date(),
      windowId: windowId,
      title: descriptor.title,
      window: window // Store the BrowserWindow instance for later reference
    };
    this.cachedStates.push(newWindowState);

    /* -- Subscribe to Events -- */
    window.on("close", () => this.windowClosing(window, true));

    window.on("closed", (event: WindowEvent) => {
      // Clean up the reference to the BrowserWindow instance in the cached state
      console.log(`[WindowStateCacher] Window with ID ${windowId} closed. Removing reference from cache.`);
      console.log(`[WindowStateCacher]   WindowID that was closed:`, window.id);
      this.removeWindowRefFromCache(window);
    })

    /* -- Log that we added a new window state -- */
    console.log(`[WindowStateCacher] Added new window state: Descriptor: ${newWindowState.descriptor}, Window ID: ${newWindowState.windowId}, Opened At: ${newWindowState.openedAt}`);
  }

  /**
   * Retrieves the last closed window state. This will also remove it from the cache.
   * @return {CachedWindowState | null} The last closed window state, or null if we don't have a reference to the last closed window.
   */
  popLastClosedWindow(): CachedWindowState | null {
    if (!this.lastClosedWindow) {
      console.warn("[WindowStateCacher] No last closed window state to pop.");
      return null;
    }
    if( this.lastClosedWindow.closedAt == null) {
      console.warn("[WindowStateCacher] Last closed window state does not have a closedAt timestamp. Cannot pop.");
      return null;
    }
    if (this.lastClosedWindow.window){
      console.warn("[WindowStateCacher] Last closed window state still has a reference to the BrowserWindow instance. This should not happen.");
      return null;
    }
    const lastClosed = this.lastClosedWindow;
    this.lastClosedWindow = null; // Clear the reference to the last closed window
    lastClosed.closedAt = new Date(0); // Set to epoch time to force it to be removed from the cache on next flush
    this.flushExpiredWindowStates();
    console.log("[WindowStateCacher] Popped last closed window state:", lastClosed);
    return lastClosed;
  }

  /**
   * Marks a window as closed. 
   * Be sure to call this method on the window's `close` event.
   * @param window The BrowserWindow instance that is being closed.
   * @param updateState Whether to update the state of the window. Defaults to true.
   */
  windowClosing(window: BrowserWindow, updateState: boolean = true): void {
    const windowId = window.id; // Get the window ID from the BrowserWindow instance
    const now = new Date();
    const cachedWindowState = this.cachedStates.find(ws => ws.windowId === windowId);
    if (!cachedWindowState) {
      console.warn(`[WindowStateCacher] Attempted to close a window with ID ${windowId} that could not be found.`);
      return;
    }
    cachedWindowState.closedAt = now; // Set the closed timestamp
    console.log(`[WindowStateCacher] Window with ID ${windowId} closed at ${now}`);
    if (updateState) {
      WindowStateCacher.updateWindowState(window, cachedWindowState);
    }
    this.lastClosedWindow = cachedWindowState; // Store the last closed window state
  }

  private removeWindowRefFromCache(window: BrowserWindow): void {

    const index = this.cachedStates.findIndex(ws => ws.window === window);
    if (index < 0) {
      console.warn(`[WindowStateCacher] Attempted to remove a window that was not found in the cache.`, window);
      return;
    }
    if (index >= 0) {
      this.cachedStates[index].window = undefined; // Clear the reference to the BrowserWindow instance
      console.log(`[WindowStateCacher] Cleared BrowserWindow reference for window ID ${this.cachedStates[index].windowId}`);
    }
  }

  /**
   * Updates the cached state for all cached window.
   */
  updateCache(): void {
    for (const cachedWindowState of this.cachedStates) {
      if (cachedWindowState.window && !cachedWindowState.closedAt) {
        WindowStateCacher.updateWindowState(cachedWindowState.window, cachedWindowState);
      }
    }
  }


  /**
   * A utility method to update the cached state of a window.
   */
  private static updateWindowState(window: Electron.BrowserWindow, cachedWindowState: CachedWindowState): void {

    if (window.isMaximized()) {
      delete cachedWindowState.descriptor.width;
      delete cachedWindowState.descriptor.height;
      delete cachedWindowState.descriptor.x;
      delete cachedWindowState.descriptor.y;
    } else {
      const bounds = window.getBounds();
      cachedWindowState.descriptor.width = bounds.width;
      cachedWindowState.descriptor.height = bounds.height;
      cachedWindowState.descriptor.x = bounds.x;
      cachedWindowState.descriptor.y = bounds.y;
    }
    cachedWindowState.descriptor.maximized = window.isMaximized();
    cachedWindowState.descriptor.title = window.getTitle();
    cachedWindowState.title = cachedWindowState.descriptor.title;

    const url = window.webContents.getURL();
    if (!isUrlInvalid(url)) {
      cachedWindowState.descriptor.url = url; 
    }else {
      console.warn(`[WindowStateCacher] Attempted to update window state with an invalid URL: ${url}, CachedWindowState:`, cachedWindowState);
    }

    console.log("[WindowStateCacher] Updated state for window #", window.id);
  }

  /**
   * Returns all valid cached window states.
   * This method will also flush any expired window states before returning the cached states.
   * @returns {Array<CachedWindowState>} An array of cached window states.
   */
  getWindowStates(): Array<CachedWindowState> {
    console.log("[WindowStateCacher] Getting window states:", this.cachedStates);
    this.flushExpiredWindowStates();
    return this.cachedStates;
  }

  /**
   * Returns all open windows that are currently cached.
   * This method will also flush any expired window states before returning the open windows.
   * @returns {Array<CachedWindowState>} An array of open window states.
   */
  getOpenWindows(): Array<CachedWindowState> {
    this.flushExpiredWindowStates();
    const openWindows = this.cachedStates.filter(ws => !ws.closedAt);
    console.log("[WindowStateCacher] Open windows:", openWindows);
    return openWindows;
  }

  /**
   * Returns all closed windows that have not yet expired.
   * This method will also flush any expired window states before returning the closed windows.
   * @returns {Array<CachedWindowState>} An array of non-expired closed window states.
   */
  getNonExpiredClosedWindows(): Array<CachedWindowState> {
    this.flushExpiredWindowStates();
    const nonExpiredClosedWindows = this.cachedStates.filter(ws => ws.closedAt && (Date.now() - ws.closedAt.getTime()) < CLOSED_TIMEOUT);
    console.log("[WindowStateCacher] Non-expired closed windows:", nonExpiredClosedWindows);
    return nonExpiredClosedWindows;
  }

  /**
   * Removes any expired window states from the internal state.
   */
  private flushExpiredWindowStates(): void {
    const now = Date.now();
    this.cachedStates = this.cachedStates.filter(cachedWindowState => {
      if (cachedWindowState.closedAt) {
        const closedTime = cachedWindowState.closedAt.getTime();
        // Keep the window state if it was closed within the timeout period
        return (now - closedTime) < CLOSED_TIMEOUT;
      }
      return true; // Keep windows that are still open
    });
    console.log("[WindowStateCacher] Flushed expired window states. Remaining states:", this.cachedStates);
  }

  /**
   * Returns the count of currently opened windows.
   * 
   * @returns {number} The count of opened windows.
   */
  openedWindowsCount(): number {
    this.flushExpiredWindowStates();
    const count = this.cachedStates.filter(ws => !ws.closedAt).length; // Count only windows that are still open
    console.log("[WindowStateCacher] Opened windows count:", count);
    return count;
  }

  /**
   * Returns the count of closed windows that have not yet expired.
   * 
   * @returns {number} The count of closed but not expired windows.
   */
  nonExpiredClosedWindowsCount(): number {
    this.flushExpiredWindowStates();
    const count = this.cachedStates.filter(ws => ws.closedAt).length;
    console.log("[WindowStateCacher] Closed but not expired windows count:", count);
    return count;
  }
}


export interface CachedWindowState {
  descriptor: WindowItem;
  closedAt?: Date;   // Timestamp for when the window was closed. This is used for when all windows are closed and the app is quitting.
  title?: string;    // Optional title for the window. Used for debugging purposes.
  windowId?: number; // Optional window ID for tracking purposes.
  openedAt?: Date;   // Optional timestamp for when the window was opened.
  window?: BrowserWindow; // Optional reference to the BrowserWindow instance, if available.
}

/* ---------- Utility Functions ---------- */

//TODO: Move `isUrlInvalid` to a separate utility module as we are using it in multiple places.

/**
 * Checks if a given URL is invalid.
 * A URL is considered invalid if it is null, empty, or equal to "about:blank".
 * 
 * @param url The URL to check.
 * @returns {boolean} True if the URL is invalid, false otherwise.
 */
function isUrlInvalid(url: string): boolean {
  return url == null || url.length === 0 || url === "about:blank";
}

