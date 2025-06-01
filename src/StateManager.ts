import Store from "electron-store";

/* ----- Configuration ----- */

export const DEFAULT_URL = "https://cad.onshape.com/";

export const DEFAULT_WINDOW_SIZE = {
  width: 1200,
  height: 800
};

/* ----- End Configuration ----- */

const WINDOW_STORAGE_KEY = "windowsState";

function defaultWindows(): Array<WindowItem> {
  // Returns a new array to avoid mutating the original array
  return [
    { 
      url: DEFAULT_URL,
      width: DEFAULT_WINDOW_SIZE.width,
      height: DEFAULT_WINDOW_SIZE.height,
    }
  ];
}

export class StateManager {
  private store = new Store();
  private windowDescriptors: Array<WindowItem> = defaultWindows();

  /**
   * Resets the stored state of the windows to the default state.
   * @deprecated This method has been deprecated due to unclear naming. Please use `resetSavedWindowsState()` instead.
   */
  restoreWindows(): void {
    this.resetSavedWindowsState();
  }

  /**
   * Resets the stored state of the windows to the default state.
   * This method clears the stored windows state and sets it to the default configuration.
   */
  resetSavedWindowsState(): void {
    console.log("[StateManager] Resetting windows state to default");
    this.store.delete(WINDOW_STORAGE_KEY);
    this.windowDescriptors = defaultWindows();
    // Save the restored default state to the store
    this.save("Via StateManager.resetSavedWindowsState()");
  }

  /**
   * Retrieves the current windows state as a JSON string. For debugging purposes.
   * @returns A JSON string representation of the current windows state, or undefined if no state is stored.
   * @deprecated
   */
  getWindowsJSON(): string | undefined {
    const serializedData = this.store.get(WINDOW_STORAGE_KEY) as string | undefined;
    // console.log("[StateManager] Got windows JSON String Data:", serializedData);
    return serializedData;
  }

  /**
   * Retrieves the current windows state.
   * @returns An array of WindowItem objects representing the current windows state.
   */
  getWindows(): Array<WindowItem> {

    const serializedData = this.store.get(WINDOW_STORAGE_KEY) as string | undefined;

    console.log("[StateManager] Got windows state:", serializedData);
    
    if (serializedData == null) {
      console.log("[StateManager] No windows state found, using default");
      this.windowDescriptors = defaultWindows();

      // this.save();
      return this.windowDescriptors;
    }

    let result: Array<WindowItem>;
    try {
      // Check if the data is a valid JSON string
      // Parse the JSON
      result = JSON.parse(serializedData);
      console.log("[StateManager] Parsed windows state:", result);
      this.windowDescriptors = result as Array<WindowItem>;

    } catch (error) {
      console.error("[StateManager] Malformed JSON data:", error);
      // If parsing fails, use default windows
      this.windowDescriptors = defaultWindows();
    }
    return this.windowDescriptors;
  }

  /**
   * Saves the current windows state to the store for persistence.
   */
  save(msg: number | string | null = null): void {
    // console.log("[StateManager] Saving windows state");
    let message = msg !== null ? ` (${msg}):` : ":";
    try {
      const serializedData = JSON.stringify(this.windowDescriptors);
      this.store.set(WINDOW_STORAGE_KEY, serializedData);
      console.log("[StateManager] Saved serialized windows state"+message, serializedData);

    } catch (error) {
      console.error("[StateManager] Error saving windows state:", error);
    } finally {
      // console.log("[StateManager] Done Saving windows state");
    }
  }

  /**
   * Overwrites the current window descriptors state with new data.
   * This method replaces the existing window descriptors with the provided array.
   * Does not save the state automatically, call `save()` after this method if needed.
   * Will do nothing if the new data is empty. To clear the state, use `clearWindowDescriptorsState()`.
   */
  setWindowDescriptorsState(newWindowDescriptors: Array<WindowItem>): void {
    if (newWindowDescriptors.length === 0) {
      console.warn("[StateManager] Attempted to overwrite window descriptors state with an empty array. No changes made.");
      return;
    }
    console.log(`[StateManager] Overwriting window descriptors state with new data. # of windows: ${newWindowDescriptors.length}`);
    this.windowDescriptors = newWindowDescriptors;  
  }

  /**
   * Clears the current window descriptors state.
   * This method removes all window descriptors from the state.
   * Does not save the state automatically, call `save()` after this method if needed.
   */
  clearWindowDescriptorsState(): void {
    console.log("[StateManager] Clearing window descriptors state");
    this.windowDescriptors = [];
  }
}

// TODO: Support remembering the last focused window. Use the `focus` & `blur` events to track the last focused window.
export interface WindowItem {
  url: string;
  title?: string;      // Optional title for the window. Used for debugging purposes.
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  maximized?: boolean;
}
