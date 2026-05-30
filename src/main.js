const { app, BrowserWindow, Menu, Tray, ipcMain, nativeImage, screen } = require("electron");
const path = require("path");

let mainWindow = null;
let tray = null;
let randomPaused = false;

const states = [
  "idle",
  "running-right",
  "running-left",
  "waving",
  "jumping",
  "failed",
  "waiting",
  "running",
  "review",
];

const stateLabels = {
  idle: "待机",
  "running-right": "向右跑",
  "running-left": "向左跑",
  waving: "挥手",
  jumping: "跳跃",
  failed: "失败",
  waiting: "发呆",
  running: "跑步",
  review: "检查",
};

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 192,
    height: 208,
    minWidth: 96,
    minHeight: 104,
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    resizable: false,
    movable: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.setAlwaysOnTop(true, "screen-saver");
  mainWindow.loadFile(path.join(__dirname, "index.html"));
  placeNearBottomRight(mainWindow);
}

function placeNearBottomRight(win) {
  const display = screen.getPrimaryDisplay();
  const { workArea } = display;
  win.setBounds({
    x: workArea.x + workArea.width - 230,
    y: workArea.y + workArea.height - 250,
    width: 192,
    height: 208,
  });
}

function sendState(state) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("set-state", state);
  }
}

function sendRandomPaused() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("set-random-paused", randomPaused);
  }
}

function refreshTrayMenu() {
  if (tray) {
    tray.setContextMenu(buildContextMenu());
  }
}

function buildContextMenu() {
  return Menu.buildFromTemplate([
    {
      label: mainWindow && mainWindow.isVisible() ? "隐藏" : "显示",
      click: () => {
        if (!mainWindow) return;
        if (mainWindow.isVisible()) {
          mainWindow.hide();
        } else {
          mainWindow.show();
          mainWindow.focus();
        }
        refreshTrayMenu();
      },
    },
    { type: "separator" },
    {
      label: "动作",
      submenu: states.map((state) => ({
        label: stateLabels[state],
        click: () => sendState(state),
      })),
    },
    { type: "separator" },
    {
      label: "静止模式",
      type: "checkbox",
      checked: randomPaused,
      click: (menuItem) => {
        randomPaused = menuItem.checked;
        sendRandomPaused();
        refreshTrayMenu();
      },
    },
    {
      label: "开机自启",
      type: "checkbox",
      checked: app.getLoginItemSettings().openAtLogin,
      click: (menuItem) => {
        app.setLoginItemSettings({ openAtLogin: menuItem.checked });
        refreshTrayMenu();
      },
    },
    {
      label: "重置位置",
      click: () => {
        if (mainWindow) placeNearBottomRight(mainWindow);
      },
    },
    { type: "separator" },
    {
      label: "退出",
      click: () => app.quit(),
    },
  ]);
}

function createTray() {
  const icon = nativeImage.createFromPath(path.join(__dirname, "..", "assets", "tray.png"));
  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon);
  tray.setToolTip("Basketball Duck Pet");
  tray.setContextMenu(buildContextMenu());
  tray.on("click", () => {
    if (!mainWindow) return;
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
    }
    tray.setContextMenu(buildContextMenu());
  });
}

ipcMain.handle("window:get-bounds", () => mainWindow.getBounds());
ipcMain.handle("window:get-cursor", () => screen.getCursorScreenPoint());
ipcMain.on("window:set-position", (_event, point) => {
  if (!mainWindow) return;
  mainWindow.setPosition(Math.round(point.x), Math.round(point.y), false);
});
ipcMain.on("window:show-menu", () => {
  if (!mainWindow) return;
  buildContextMenu().popup({ window: mainWindow });
});
ipcMain.on("window:set-ignore-mouse", (_event, ignore) => {
  if (!mainWindow) return;
  mainWindow.setIgnoreMouseEvents(Boolean(ignore), { forward: true });
});

app.whenReady().then(() => {
  createWindow();
  createTray();
  mainWindow.webContents.once("did-finish-load", sendRandomPaused);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
      mainWindow.webContents.once("did-finish-load", sendRandomPaused);
    }
  });
});

app.on("window-all-closed", () => {
  app.quit();
});
