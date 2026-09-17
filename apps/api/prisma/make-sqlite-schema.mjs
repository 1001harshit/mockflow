/**
 * Derives the SQLite schema from the Postgres one.
 *
 * Prisma requires the datasource provider to be a literal, so one schema can't
 * serve both. Rather than keep two files in step by hand, the Postgres schema
 * stays the single source of truth and this rewrites its datasource block for
 * the desktop build. The output is generated, so it is gitignored.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const source = join(here, 'schema.prisma');
const outDir = join(here, 'sqlite');
const target = join(outDir, 'schema.prisma');

let schema = readFileSync(source, 'utf8');

if (!schema.includes('provider = "postgresql"')) {
  throw new Error('Expected a postgresql datasource in prisma/schema.prisma');
}

schema = schema.replace('provider = "postgresql"', 'provider = "sqlite"');

// The generated client has to land somewhere other than the Postgres client,
// or whichever ran last would win for both targets. It sits beside src rather
// than inside it, so the same relative path resolves from src and from dist.
schema = schema.replace(
  'generator client {\n  provider = "prisma-client-js"\n}',
  'generator client {\n  provider = "prisma-client-js"\n  output   = "../../generated/sqlite"\n}',
);

const banner = [
  '// GENERATED — do not edit.',
  '// Produced from prisma/schema.prisma by prisma/make-sqlite-schema.mjs.',
  '// Edit the Postgres schema and re-run `pnpm db:sqlite:sync`.',
  '',
].join('\n');

mkdirSync(outDir, { recursive: true });
writeFileSync(target, banner + schema);
console.log(`wrote ${target}`);
