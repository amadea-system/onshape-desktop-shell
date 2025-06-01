import { app, BrowserWindow, ipcMain, Menu, shell, WebContents, dialog, clipboard } from "electron";
import { AppSignal } from "./electronEventSignals";
import { WINDOW_NAVIGATED } from "./WindowManager";
import { MenuItemConstructorOptions } from "electron/main";
import { clearCredentials, getStoredCredentials } from "./secureStorage";
import { log } from "./util";
import { getWindowManager } from "./WindowManagerInstance";

const accelerators_default = {
  "window": {
    "minimize": "CmdOrCtrl+M",
    "close": "CmdOrCtrl+W",
    "newWindow": undefined,
    "reopenLastClosedWindow": undefined
  },
  "edit": {
    "undo": "CmdOrCtrl+Z",
    "redo": "Shift+CmdOrCtrl+Z",
    "cut": "CmdOrCtrl+X",
    "copy": "CmdOrCtrl+C",
    "paste": "CmdOrCtrl+V",
    "selectAll": "CmdOrCtrl+A",
    // "copyURL": "CmdOrCtrl+Shift+C"
    "copyURL": undefined,
    "copyMarkdownAddress": undefined
  },
  "view": {
    "reload": "CmdOrCtrl+R",
    "enterFullScreen": process.platform === 'darwin' ? 'Ctrl+Command+F' : 'F11',
    "toggleDevTools": process.platform === 'darwin' ? 'Alt+Command+I' : 'Ctrl+Shift+I'
  },
  "history": {
    "back": "CmdOrCtrl+[",
    "forward": "CmdOrCtrl+]",
    "home": "Shift+CmdOrCtrl+H"
  },
  "account": {
    "clearSavedCredentials": undefined
  },
  "help": {
    "help": undefined,
    "support": undefined,
    "forums": undefined,
    "blog": undefined,
    "status": undefined 
  },
  "macMenu": {
    "about": undefined,
    "hide": "Command+H",
    "hideOthers": "Command+Shift+H",
    "showAll": undefined,
    "quit": "Command+Q"
  }
};

const kb_shortcuts = accelerators_default;

export default function setMenu(homeUrl: string): void {
  const windowsMenu: MenuItemConstructorOptions = {
    label: 'Window',
    role: 'window',
    submenu: [
      {
        label: 'Minimize',
        accelerator: kb_shortcuts.window.minimize,
        role: 'minimize'
      },
      {
        label: 'Close',
        accelerator: kb_shortcuts.window.close,
        role: 'close'
      },
      {
        type: 'separator'
      },
      {
        label: 'Open New Window',
        accelerator: kb_shortcuts.window.newWindow,
        click: () => {
          const wm = getWindowManager();
          if (wm) {
            wm.openNewWindow();
            log("[AppMenuManager] Opened new window");
          } else {
            console.log("[AppMenuManager] WindowManager not found.");
          }
        }
      },
      {
        label: 'Reopen Last Closed Window',
        accelerator: kb_shortcuts.window.reopenLastClosedWindow,
        click: () => {
          const wm = getWindowManager();
          if (wm) {
            wm.reopenLastClosedWindow();
            log("[AppMenuManager] Reopened last closed window");
          } else {
            console.log("[AppMenuManager] WindowManager not found.");
          }
        }
      }
    ]
  };

  const name = app.getName();
  const template: Array<MenuItemConstructorOptions> = [
    {
      label: 'Edit',
      submenu: [
        {
          label: 'Undo',
          accelerator: kb_shortcuts.edit.undo,
          role: 'undo'
        },
        {
          label: 'Redo',
          accelerator: kb_shortcuts.edit.redo,
          role: 'redo'
        },
        {
          type: 'separator'
        },
        {
          label: 'Cut',
          accelerator: kb_shortcuts.edit.cut,
          role: 'cut'
        },
        {
          label: 'Copy',
          accelerator: kb_shortcuts.edit.copy,
          role: 'copy'
        },
        {
          label: 'Paste',
          accelerator: kb_shortcuts.edit.paste,
          role: 'paste'
        },
        {
          label: 'Select All',
          accelerator: kb_shortcuts.edit.selectAll,
          role: 'selectAll'
        },
        {
          type: 'separator'
        },
        {
          label: 'Copy URL',
          accelerator: kb_shortcuts.edit.copyURL,
          click: () => {
            const webContents = getFocusedWebContents();
            if (webContents) {
              const url = webContents.getURL();
              if (url) {
                // Copy the URL to clipboard
                clipboard.writeText(url);
                console.log('URL copied to clipboard:', url);
              }
            }
          }
        },
        {
          label: 'Copy Markdown Address',
          accelerator: kb_shortcuts.edit.copyMarkdownAddress,
          click: () => {
            const webContents = getFocusedWebContents();
            if (webContents) {
              const url = webContents.getURL();
              const title = webContents.getTitle();
              if (url) {
                // Copy the URL in Markdown format to clipboard
                const markdownUrl = `[${title}](${url})`;
                clipboard.writeText(markdownUrl);
                console.log('Markdown URL copied to clipboard:', markdownUrl);
              }
            }
          }
        },
      ]
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Reload',
          accelerator: kb_shortcuts.view.reload,
          click: (_item, focusedWindow) => {
            if (focusedWindow != null) {
              focusedWindow.reload();
            }
          }
        },
        {
          label: 'Enter Full Screen',
          // accelerator: process.platform === 'darwin' ? 'Ctrl+Command+F' : 'F11',
          accelerator: kb_shortcuts.view.enterFullScreen,
          click: (_item, focusedWindow) => {
            if (focusedWindow) {
              focusedWindow.setFullScreen(!focusedWindow.isFullScreen());
            }
          }
        },
        {
          type: 'separator'
        },
        {
          label: 'Toggle Developer Tools',
          // accelerator: process.platform === 'darwin' ? 'Alt+Command+I' : 'Ctrl+Shift+I',
          accelerator: kb_shortcuts.view.toggleDevTools,
          click: (_item, focusedWindow) => {
            if (focusedWindow) {
              focusedWindow.webContents.toggleDevTools();
            }
          }
        },
      ]
    },
    {
      label: 'History',
      submenu: [
        {
          label: 'Back',
          accelerator: kb_shortcuts.history.back,
          enabled: false,
          click: () => {
            historyGo(true);
          }
        },
        {
          label: 'Forward',
          enabled: false,
          accelerator: kb_shortcuts.history.forward,
          click: () => {
            historyGo(false);
          }
        },
        {
          label: 'Home',
          enabled: false,
          accelerator: kb_shortcuts.history.home,
          click: () => {
            const webContents = getFocusedWebContents();
            if (webContents != null) {
              webContents.loadURL(homeUrl);
            }
          }
        },
      ]
    },
    windowsMenu,
    {
      label: 'Help',
      role: 'help',
      submenu: [
        {
          label: `${name} Help`,
          click: () => { shell.openExternal('https://cad.onshape.com/help/'); }
        },
        {
          label: `${name} Support`,
          click: () => { shell.openExternal('https://www.onshape.com/support/'); }
        },
        {
          label: `${name} Forums`,
          click: () => { shell.openExternal('https://forum.onshape.com/'); }
        },
        {
          label: `${name} Blog`,
          click: () => { shell.openExternal('https://www.onshape.com/cad-blog/'); }
        },
        {
          type: 'separator'
        },
        {
          label: `${name} Status`,
          click: () => { shell.openExternal('http://status.onshape.com/'); }
        },
      ]
    },
  ];

  if (process.platform === 'darwin') {
    template.unshift({
      label: name,
      submenu: [
        {
          label: `About ${name}`,
          role: 'about'
        },
        {
          type: 'separator'
        },
        {
          label: `Hide ${name}`,
          accelerator: kb_shortcuts.macMenu.hide,
          role: 'hide'
        },
        {
          label: 'Hide Others',
          accelerator: kb_shortcuts.macMenu.hideOthers,
          role: 'hideOthers'
        },
        {
          label: 'Show All',
          role: 'unhide'
        },
        {
          type: 'separator'
        },
        {
          label: 'Quit',
          accelerator: kb_shortcuts.macMenu.quit,
          click: () => {
            app.quit();
          }
        }
      ]
    });

    const windowSubmenu = windowsMenu.submenu as MenuItemConstructorOptions[];
    windowSubmenu.push(
      {
        type: 'separator'
      },
      {
        label: 'Bring All to Front',
        role: 'front'
      }
    );
  }
  const appMenu = Menu.buildFromTemplate(template);
  // Update history menu items
  for (const item of appMenu.items) {
    if (item.label === "History") {
      const submenu = item.submenu;
      if (submenu) {
        updateHistoryMenuItems(submenu.items, homeUrl);
      }
      break;
    }
  }
  
  Menu.setApplicationMenu(appMenu);
}

function updateHistoryMenuItems(items: Electron.MenuItem[], homeUrl: string): void {

  function updateEnabled(webContents: WebContents | null): void {
    items[0].enabled = webContents ? webContents.canGoBack() : false;
    items[1].enabled = webContents ? webContents.canGoForward() : false;
  }

  ipcMain.on(WINDOW_NAVIGATED, (arg1: any, url: string) => {
    // Check if arg1 is a WebContents object by looking for characteristic methods
    if (arg1 && typeof arg1.canGoBack === 'function' && typeof arg1.canGoForward === 'function') {
      const webContents = arg1 as WebContents;
      updateEnabled(webContents);
      
      // TODO: Restore the disable home button functionality
      // Check if url is not the homeUrl
      // if (url) {
      //   items[2].enabled = url.replace(/(\?.*)|(#.*)/g, "") !== homeUrl;
      // }
      items[2].enabled = true; // Always enable the home button
    }else {
      // Log a message if webContents is not valid
      // console.log("Invalid webContents object in WINDOW_NAVIGATED event: ", webContents);
      console.log("Invalid arg1 object in WINDOW_NAVIGATED event: ", arg1);
      console.log("arg1 type: ", typeof arg1);
      console.log("arg1 properties: ", Object.keys(arg1));
    }
  });

  new AppSignal()
    .windowBlurred(() => {
      items[0].enabled = false;
      items[1].enabled = false;
    })
    .windowFocused((_event, window) => {
      updateEnabled(window.webContents);
    });
}

function getFocusedWebContents(): Electron.WebContents | null {
  const focusedWindow = BrowserWindow.getFocusedWindow();
  return focusedWindow ? focusedWindow.webContents : null;
}

function historyGo(back: boolean): void {
  const webContents = getFocusedWebContents();
  if (webContents) {
    if (back) {
      webContents.goBack();
    } else {
      webContents.goForward();
    }
  }
}