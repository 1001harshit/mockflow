'use strict';

const { execFile } = require('node:child_process');
const { existsSync } = require('node:fs');
const { join } = require('node:path');
const { needsNodeFlag } = require('./node-bin');

/**
 * Brings the user's database up to date before the API is allowed to touch it.
 *
 * On a first launch there is no database at all, and on an update there may be
 * an old one. Without this the API connects happily to an empty SQLite file
 * and then fails on the first query with "table does not exist", which reads
 * like a corrupt install rather than a missing step.
 *
 * `migrate deploy` only applies committed migrations and never prompts or
 * resets, which is what you want against data somebody cares about.
 */
function migrate({ root, databaseUrl, node }) {
  return new Promise((resolve, reject) => {
    const prismaBin = require.resolve('prisma/build/index.js', {
      paths: [join(root, 'apps', 'api')],
    });
    const schema = join(root, 'apps', 'api', 'prisma', 'schema.prisma');

    if (!existsSync(schema)) {
      reject(new Error(`Prisma schema not found at ${schema}`));
      return;
    }

    execFile(
      node,
      [prismaBin, 'migrate', 'deploy', '--schema', schema],
      {
        env: {
          ...process.env,
          DATABASE_URL: databaseUrl,
          // Only when we fell back to Electron's binary — it would otherwise
          // boot a second app that never exits instead of running the CLI.
          ...(needsNodeFlag(node) ? { ELECTRON_RUN_AS_NODE: '1' } : {}),
        },
        cwd: root,
      },
      (err, stdout, stderr) => {
        if (err) {
          reject(new Error(`Database migration failed: ${stderr || stdout || err.message}`));
          return;
        }
        resolve(stdout.trim());
      },
    );
  });
}

module.exports = { migrate };
