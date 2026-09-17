'use strict';

const { spawn } = require('node:child_process');
const { join } = require('node:path');
const { randomBytes } = require('node:crypto');
const { freePort, waitForHttp } = require('./ports');

/**
 * Starts the API and the dashboard as child processes and keeps hold of them.
 *
 * These are the same two servers the web build runs. Nothing here is a desktop
 * variant of the product — the shell is a supervisor, not a fork.
 */

/** Where the repo sits relative to this file, both packaged and unpackaged. */
function repoRoot(appPath) {
  return join(appPath, '..', '..');
}

function startProcess(name, command, args, options, onFatal) {
  const child = spawn(command, args, {
    ...options,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const tag = `[${name}]`;
  child.stdout.on('data', (d) => process.stdout.write(`${tag} ${d}`));
  child.stderr.on('data', (d) => process.stderr.write(`${tag} ${d}`));

  child.on('exit', (code, signal) => {
    // A clean shutdown during quit passes through here too; the caller decides
    // whether an exit is fatal by clearing onFatal before stopping.
    if (onFatal) onFatal(new Error(`${name} exited (code ${code}, signal ${signal})`));
  });

  return child;
}

async function start({ appPath, userDataPath, onFatal }) {
  const root = repoRoot(appPath);
  const apiPort = await freePort();
  const webPort = await freePort();

  // The database lives with the user's other application data, not inside the
  // app bundle — a bundle is replaced wholesale on update.
  const databaseUrl = `file:${join(userDataPath, 'mockflow.db')}`;

  const env = {
    ...process.env,
    NODE_ENV: 'production',
    DATABASE_URL: databaseUrl,
    PORT: String(apiPort),
    // Secrets that only ever sign tokens for this machine's own session. A
    // shipped constant would be the same on every install, which is worse.
    JWT_ACCESS_SECRET: randomBytes(32).toString('hex'),
    JWT_REFRESH_SECRET: randomBytes(32).toString('hex'),
    JWT_ACCESS_TTL: '15m',
    JWT_REFRESH_TTL: '7d',
    NEXT_PUBLIC_API_URL: `http://127.0.0.1:${apiPort}`,
  };

  const api = startProcess(
    'api',
    process.execPath,
    [join(root, 'apps', 'api', 'dist', 'main.js')],
    { cwd: root, env },
    onFatal,
  );

  const web = startProcess(
    'web',
    process.execPath,
    [
      join(root, 'node_modules', 'next', 'dist', 'bin', 'next'),
      'start',
      '--port',
      String(webPort),
      '--hostname',
      '127.0.0.1',
    ],
    { cwd: join(root, 'apps', 'dashboard'), env },
    onFatal,
  );

  await waitForHttp(`http://127.0.0.1:${apiPort}/health`);
  await waitForHttp(`http://127.0.0.1:${webPort}/login`);

  return {
    apiPort,
    webPort,
    url: `http://127.0.0.1:${webPort}`,
    databaseUrl,
    stop() {
      for (const child of [api, web]) {
        if (child && !child.killed) child.kill('SIGTERM');
      }
    },
  };
}

module.exports = { start };
