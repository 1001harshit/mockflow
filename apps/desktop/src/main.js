'use strict';

const { app, BrowserWindow } = require('electron');

/**
 * MockFlow desktop shell.
 *
 * This process owns no product logic. It starts the same API and dashboard the
 * web build runs, waits for them to answer, and points a window at them — so a
 * fix to the web app is a fix to the desktop app, because they are one build.
 */

let window = null;

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
  window.on('closed', () => {
    window = null;
  });

  return window;
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// macOS keeps applications running with no windows; everywhere else, closing
// the last window means quitting.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
