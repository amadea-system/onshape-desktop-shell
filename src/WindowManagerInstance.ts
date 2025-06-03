import WindowManager from "./WindowManager.js";

let windowManager: WindowManager | null = null;

export function getWindowManager(): WindowManager | null {
  return windowManager;
}

export function setWindowManager(instance: WindowManager) {
  windowManager = instance;
}
