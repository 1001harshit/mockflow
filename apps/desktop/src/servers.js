'use strict';

const { spawn } = require('node:child_process');
const { join } = require('node:path');
const { randomBytes } = require('node:crypto');
const { freePort, waitForHttp } = require('./ports');
const { migrate } = require('./migrate');
const { nodeBinary, needsNodeFlag } = require('./node-bin');
const { remember, forget, reap } = require('./children');

/**
 * Starts the API and the dashboard as child processes and keeps hold of them.
 *
 * These are the same two servers the web build runs. Nothing here is a desktop
 * variant of the product — the shell is a supervisor, not a fork.
 */

/**
 * Where the API and dashboard are.
 *
 * Running `electron apps/desktop` puts the app path two levels below the repo.
 * A bundled build puts it inside MockFlow.app instead, which is nowhere near
 * the code — so the bundle states the root outright and that wins.
 */
function repoRoot(appPath) {
  return process.env.MOCKFLOW_ROOT || join(appPath, '..', '..');
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

  // A previous run may have been killed rather than quit, leaving servers alive
  // and holding the database. Clear those out before touching it.
  const reaped = reap(userDataPath);
  if (reaped > 0) {
    // eslint-disable-next-line no-console
    console.log(`[shell] stopped ${reaped} server(s) left by a previous run`);
    // Give the OS a moment to release the file locks with them.
    await new Promise((r) => setTimeout(r, 400));
  }

  const apiPort = await freePort();
  const webPort = await freePort();

  // The database lives with the user's other application data, not inside the
  // app bundle — a bundle is replaced wholesale on update.
  const databaseUrl = `file:${join(userDataPath, 'mockflow.db')}`;

  const node = nodeBinary();

  const env = {
    ...process.env,
    // Only needed when we had to fall back to Electron's own binary.
    ...(needsNodeFlag(node) ? { ELECTRON_RUN_AS_NODE: '1' } : {}),
    NODE_ENV: 'production',
    // Its own build directory, so a running `pnpm dev` cannot be serving from
    // the same place this reads.
    NEXT_DIST_DIR: '.next-desktop',
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

  // Migrate before anything connects: the API would otherwise open an empty
  // file and fail on its first query.
  await migrate({ root, databaseUrl, node });

  const api = startProcess(
    'api',
    node,
    [join(root, 'apps', 'api', 'dist', 'main.js')],
    { cwd: root, env },
    onFatal,
  );

  // pnpm does not hoist dependencies to the root, so Next lives under the
  // dashboard package. Resolve it rather than guessing at a layout.
  const dashboardDir = join(root, 'apps', 'dashboard');
  const nextBin = require.resolve('next/dist/bin/next', { paths: [dashboardDir] });

  const web = startProcess(
    'web',
    node,
    [nextBin, 'start', '--port', String(webPort), '--hostname', '127.0.0.1'],
    { cwd: dashboardDir, env },
    onFatal,
  );

  remember(userDataPath, [api.pid, web.pid].filter(Boolean));

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
      forget(userDataPath);
    },
  };
}

module.exports = { start };
