'use strict';

const { Menu, shell, app, clipboard, dialog } = require('electron');

/**
 * A menu with the things people reach for in a desktop app, plus the two
 * facts that are only discoverable from inside the shell: which port the mock
 * plane is on, and where the database file lives.
 */
function buildMenu({ getRunning }) {
  const isMac = process.platform === 'darwin';

  const mockflowMenu = {
    label: 'MockFlow',
    submenu: [
      {
        label: 'Copy Mock Base URL',
        accelerator: 'CmdOrCtrl+Shift+C',
        click: () => {
          const running = getRunning();
          if (!running) return;
          clipboard.writeText(`http://127.0.0.1:${running.apiPort}/mock`);
        },
      },
      {
        label: 'Show Data Folder',
        click: () => shell.openPath(app.getPath('userData')),
      },
      { type: 'separator' },
      {
        label: 'About MockFlow',
        click: () => {
          const running = getRunning();
          dialog.showMessageBox({
            type: 'info',
            title: 'MockFlow',
            message: `MockFlow ${app.getVersion()}`,
            detail: running
              ? `API   http://127.0.0.1:${running.apiPort}\n` +
                `App   ${running.url}\n` +
                `Data  ${app.getPath('userData')}`
              : 'Starting…',
          });
        },
      },
      { type: 'separator' },
      { role: 'quit' },
    ],
  };

  const template = [
    ...(isMac ? [mockflowMenu] : []),
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' }, { role: 'redo' }, { type: 'separator' },
        { role: 'cut' }, { role: 'copy' }, { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' }, { role: 'forceReload' }, { type: 'separator' },
        { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' },
        { type: 'separator' }, { role: 'togglefullscreen' },
        { type: 'separator' }, { role: 'toggleDevTools' },
      ],
    },
    { label: 'Window', submenu: [{ role: 'minimize' }, { role: 'zoom' }, { role: 'close' }] },
    ...(isMac ? [] : [mockflowMenu]),
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

module.exports = { buildMenu };
