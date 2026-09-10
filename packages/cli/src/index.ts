#!/usr/bin/env node
import { parseArgs } from './args';
import {
  chaos,
  deploy,
  describeError,
  exportSpec,
  help,
  init,
  logs,
  start,
} from './commands';

/* eslint-disable no-console */

const HANDLERS: Record<string, (ctx: { args: any; cwd: string }) => unknown> = {
  init,
  deploy,
  start,
  export: exportSpec,
  logs,
  chaos,
  help,
};

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const handler = HANDLERS[args.command];

  if (!handler) {
    console.error(`Unknown command "${args.command}"\n`);
    help();
    process.exitCode = 1;
    return;
  }

  await handler({ args, cwd: process.cwd() });
}

main().catch((err) => {
  console.error(describeError(err));
  process.exitCode = 1;
});
