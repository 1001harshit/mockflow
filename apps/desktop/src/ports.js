'use strict';

const net = require('node:net');

/**
 * Finds a free TCP port on the loopback interface.
 *
 * A desktop app cannot assume 4000 and 3000 are free — the person running it
 * is very likely a developer with something already on those ports, quite
 * possibly this project's own web build.
 */
function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    // Port 0 asks the OS for any available port.
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

/**
 * Waits for something to start answering on a URL.
 *
 * Both child processes need a moment before they serve, and showing a window
 * pointed at a port that isn't listening yet produces a connection-refused
 * page the user has to reload by hand.
 */
async function waitForHttp(url, { timeoutMs = 30_000, intervalMs = 150 } = {}) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;

  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(2_000) });
      if (res.ok) return true;
      lastError = new Error(`${url} answered ${res.status}`);
    } catch (err) {
      lastError = err;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }

  throw new Error(
    `Timed out after ${timeoutMs}ms waiting for ${url}` +
      (lastError ? ` — last error: ${lastError.message}` : ''),
  );
}

module.exports = { freePort, waitForHttp };
