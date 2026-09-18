'use strict';

const { existsSync, readFileSync, unlinkSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');

/**
 * Tracks the pids of the servers we start, so a launch can clean up after a
 * previous one that did not exit cleanly.
 *
 * If the app is killed rather than quit — a crash, Activity Monitor, a stray
 * `kill -9` — no shutdown handler runs, the children are reparented to init,
 * and they keep holding the SQLite file. The next launch then fails to migrate
 * with "database is locked", which looks like a corrupt install.
 *
 * Only pids this app recorded are ever signalled, so nothing else on the
 * machine is at risk.
 */
function pidFile(userDataPath) {
  return join(userDataPath, 'children.json');
}

function remember(userDataPath, pids) {
  try {
    writeFileSync(pidFile(userDataPath), JSON.stringify({ pids, at: Date.now() }));
  } catch {
    /* losing the record only costs us the next cleanup */
  }
}

function forget(userDataPath) {
  try {
    const path = pidFile(userDataPath);
    if (existsSync(path)) unlinkSync(path);
  } catch {
    /* ignore */
  }
}

/** Terminates any server this app left running. Returns how many it stopped. */
function reap(userDataPath) {
  const path = pidFile(userDataPath);
  if (!existsSync(path)) return 0;

  let pids = [];
  try {
    pids = JSON.parse(readFileSync(path, 'utf8')).pids ?? [];
  } catch {
    forget(userDataPath);
    return 0;
  }

  let stopped = 0;
  for (const pid of pids) {
    if (typeof pid !== 'number' || pid === process.pid) continue;
    try {
      // Signal 0 only asks whether the process exists.
      process.kill(pid, 0);
      process.kill(pid, 'SIGKILL');
      stopped++;
    } catch {
      /* already gone */
    }
  }

  forget(userDataPath);
  return stopped;
}

module.exports = { remember, forget, reap };
