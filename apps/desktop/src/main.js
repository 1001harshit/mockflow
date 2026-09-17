'use strict';

const { app, BrowserWindow, shell } = require('electron');
const servers = require('./servers');
const { failurePage } = require('./failure-page');
const { buildMenu } = require('./menu');

/**
 * MockFlow desktop shell.
 *
 * This process owns no product logic. It starts the same API and dashboard the
 * web build runs, waits for them to answer, and points a window at them — so a
 * fix to the web app is a fix to the desktop app, because they are one build.
 */

let window = null;
let running = null;
/** Cleared before a deliberate shutdown, so quitting isn't reported as a crash. */
let fatalHandler = null;

function createWindow() {
  window = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0b0a09',
    title: 'MockFlow',
    show: false,
    webPreferences: {
      // The window only ever loads our own localhost origin, and the page has
      // no reason to reach the main process. Keep the bridge shut.
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Painting an empty window and then filling it reads as a stall; waiting for
  // the first frame makes the launch feel deliberate instead.
  window.once('ready-to-show', () => window.show());

  // A window with no address bar is a bad place to land on an external site.
  window.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });
  window.on('closed', () => {
    window = null;
  });

  return window;
}

async function boot() {
  const win = createWindow();
  buildMenu({ getRunning: () => running });

  fatalHandler = (err) => {
    // A child dying after startup is still worth saying out loud.
    if (window && !window.isDestroyed()) void window.loadURL(failurePage(err.message));
  };

  // Starting the servers takes a couple of seconds, and the window can be
  // closed inside that gap — every use of it after an await has to re-check.
  const alive = () => !win.isDestroyed();

  try {
    running = await servers.start({
      appPath: app.getAppPath(),
      userDataPath: app.getPath('userData'),
      onFatal: (err) => fatalHandler && fatalHandler(err),
    });
    if (!alive()) {
      running.stop();
      return;
    }
    await win.loadURL(running.url);
  } catch (err) {
    if (alive()) await win.loadURL(failurePage(err.message));
  }
}

app.whenReady().then(boot);

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) void boot();
});

// Stop supervising before the children go, or their exit reads as a crash.
app.on('before-quit', () => {
  fatalHandler = null;
  if (running) running.stop();
});

// macOS keeps applications running with no windows; everywhere else, closing
// the last window means quitting.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
