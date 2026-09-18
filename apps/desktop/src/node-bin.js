'use strict';

const { existsSync } = require('node:fs');
const { execFileSync } = require('node:child_process');

/**
 * Finds a real `node` to run the servers with.
 *
 * Electron's own binary can run JS via ELECTRON_RUN_AS_NODE, and that works —
 * but inside a bundle the binary belongs to the app, so macOS treats every
 * child as another instance of it and puts a second icon in the dock. Using an
 * actual node keeps the app to one dock entry.
 */
let cached = null;

function nodeBinary() {
  if (cached) return cached;

  const candidates = [
    process.env.MOCKFLOW_NODE,
    // Finder launches with a minimal PATH, so look where node usually lives
    // before trusting the environment.
    '/opt/homebrew/bin/node',
    '/usr/local/bin/node',
    '/usr/bin/node',
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (existsSync(candidate)) return (cached = candidate);
  }

  try {
    const found = execFileSync('/usr/bin/which', ['node'], {
      encoding: 'utf8',
      env: process.env,
    }).trim();
    if (found && existsSync(found)) return (cached = found);
  } catch {
    /* not on PATH either */
  }

  // Last resort: Electron as Node. Costs a duplicate dock icon, but running is
  // better than not running.
  return (cached = process.execPath);
}

/** True when we fell back to Electron's binary, which needs the Node flag. */
function needsNodeFlag(bin) {
  return bin === process.execPath;
}

module.exports = { nodeBinary, needsNodeFlag };
