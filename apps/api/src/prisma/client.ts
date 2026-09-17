import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';

/* eslint-disable @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports */

/**
 * Chooses the generated client for the database this build targets.
 *
 * Prisma insists the datasource provider is a literal, so the desktop build
 * generates a second client from the same models into src/generated/sqlite.
 * Both are generated from one schema, so the types are identical and the
 * Postgres client's types stand in for either.
 *
 * Set MOCKFLOW_DB=sqlite for the desktop build; anything else uses Postgres.
 */
function resolveClient(): typeof PrismaClient {
  if ((process.env.MOCKFLOW_DB ?? '').toLowerCase() !== 'sqlite') {
    return PrismaClient;
  }
  try {
    // Resolved from the package root so it works the same compiled or not:
    // dist/prisma/ and src/prisma/ are both two levels below apps/api.
    const generated = join(__dirname, '..', '..', 'generated', 'sqlite');
    return require(generated).PrismaClient as typeof PrismaClient;
  } catch {
    throw new Error(
      'MOCKFLOW_DB=sqlite but the SQLite client is missing. Run `pnpm db:sqlite` first.',
    );
  }
}

export const DatabaseClient = resolveClient();

/** Which database this process is actually talking to — handy in logs. */
export const databaseKind =
  (process.env.MOCKFLOW_DB ?? '').toLowerCase() === 'sqlite' ? 'sqlite' : 'postgres';
