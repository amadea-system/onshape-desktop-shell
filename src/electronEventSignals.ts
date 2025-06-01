import { app } from "electron";
import type { BrowserWindow, WebContents } from "electron";

export interface WindowEvent {
  sender: BrowserWindow;
}

export interface WebContentsEvent {
  sender: WebContents;
}

function isEnvTrue(v: string | undefined): boolean {
  return v != null && (v.length === 0 || v === "true");
}

const isLogEvent = isEnvTrue(process.env.LOG_EVENTS);

function addHandler(emitter: NodeJS.EventEmitter, event: string, handler: (...args: any[]) => void): void {
  if (isLogEvent) {
    emitter.on(event, function(this: any, ...args: any[]) {
      console.log("%s %s", event, args);
      handler.apply(this, args);
    });
  } else {
    emitter.on(event, handler);
  }
}

export class WebContentsSignal {
  constructor(private emitter: WebContents) {
  }

  navigated(handler: (event: WebContentsEvent, url: string) => void): WebContentsSignal {

    addHandler(this.emitter, "did-navigate", (_event: any, url: string) => {
      const webContentsEvent: WebContentsEvent = {
        sender: this.emitter
      };
      handler(webContentsEvent, url);
    });
    return this;
  }

  navigatedInPage(handler: (event: WebContentsEvent, url: string) => void): WebContentsSignal {

    addHandler(this.emitter, "did-navigate-in-page", (_event: any, url: string) => {
      const webContentsEvent: WebContentsEvent = {
        sender: this.emitter
      };
      handler(webContentsEvent, url);
    });
    return this;
  }

  frameLoaded(handler: (event: any, isMainFrame: boolean) => void): WebContentsSignal {
    addHandler(this.emitter, "did-frame-finish-load", handler);
    return this;
  }
}

export class AppSignal {
  private emitter = app;

  windowBlurred(handler: (event: any, window: BrowserWindow) => void): AppSignal {
    addHandler(this.emitter, "browser-window-blur", handler);
    return this;
  }

  windowFocused(handler: (event: any, window: BrowserWindow) => void): AppSignal {
    addHandler(this.emitter, "browser-window-focus", handler);
    return this;
  }
}