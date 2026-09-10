import { readFileSync, watch, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { MockFlowClient, MockFlowError } from '@mockflow/sdk';
import type { FailureRule, FailureType } from '@mockflow/shared-types';
import { ParsedArgs, flagNumber, flagString } from '../args';
import {
  CONFIG_FILE,
  DEFAULT_API_URL,
  readConfig,
  resolveSettings,
  writeConfig,
} from '../config';

/* eslint-disable no-console */

export interface CommandContext {
  args: ParsedArgs;
  cwd: string;
}

function client(args: ParsedArgs, cwd: string): { api: MockFlowClient; projectId: string; spec?: string } {
  const settings = resolveSettings(args.flags, readConfig(cwd));
  if (!settings.token && !settings.apiKey) {
    throw new Error(
      'No credentials. Set MOCKFLOW_TOKEN or MOCKFLOW_API_KEY in your environment.',
    );
  }
  if (!settings.projectId) {
    throw new Error(
      `No project. Run "mockflow init" or pass --project <id>.`,
    );
  }
  return {
    api: new MockFlowClient({
      baseUrl: settings.apiUrl,
      token: settings.token,
      apiKey: settings.apiKey,
    }),
    projectId: settings.projectId,
    spec: settings.spec,
  };
}

/** Writes mockflow.json so later commands need no flags. */
export function init({ args, cwd }: CommandContext): void {
  const config = {
    apiUrl: flagString(args.flags, 'api', DEFAULT_API_URL)!,
    projectId: flagString(args.flags, 'project'),
    spec: flagString(args.flags, 'spec', './openapi.json'),
  };
  const path = writeConfig(config, cwd);

  console.log(`Wrote ${CONFIG_FILE}`);
  console.log(`  apiUrl    ${config.apiUrl}`);
  console.log(`  projectId ${config.projectId ?? '(set with --project)'}`);
  console.log(`  spec      ${config.spec}`);
  console.log(`\nExport a credential before other commands:`);
  console.log(`  export MOCKFLOW_TOKEN=...   # or MOCKFLOW_API_KEY`);
  void path;
}

/** Uploads the spec — the deploy step in a CI pipeline. */
export async function deploy({ args, cwd }: CommandContext): Promise<void> {
  const { api, projectId, spec } = client(args, cwd);
  const specPath = args.positionals[0] ?? spec;
  if (!specPath) throw new Error('No spec file. Pass one, or set "spec" in mockflow.json.');

  const document = JSON.parse(readFileSync(resolve(cwd, specPath), 'utf8'));
  const result = await api.project(projectId).importSpec(document);

  console.log(`Imported ${result.imported} endpoint(s) from ${specPath}`);
  console.log(`Mock base: ${api.mockUrl(projectId)}`);
}

/** Uploads once, then re-uploads whenever the spec changes. */
export async function start({ args, cwd }: CommandContext): Promise<void> {
  const { api, projectId, spec } = client(args, cwd);
  const specPath = args.positionals[0] ?? spec;
  if (!specPath) throw new Error('No spec file. Pass one, or set "spec" in mockflow.json.');

  const full = resolve(cwd, specPath);
  const push = async (): Promise<void> => {
    try {
      const result = await api.project(projectId).importSpec(
        JSON.parse(readFileSync(full, 'utf8')),
      );
      console.log(`[${new Date().toLocaleTimeString()}] synced ${result.imported} endpoint(s)`);
    } catch (err) {
      // A half-saved file is the common case here; keep watching rather than exit.
      console.error(`  sync failed: ${err instanceof Error ? err.message : err}`);
    }
  };

  await push();
  console.log(`Mock base: ${api.mockUrl(projectId)}`);
  console.log(`Watching ${specPath} — edit it and the mocks follow. Ctrl-C to stop.`);

  let pending: NodeJS.Timeout | null = null;
  watch(full, () => {
    // Editors write in bursts; debounce so one save is one sync.
    if (pending) clearTimeout(pending);
    pending = setTimeout(() => void push(), 150);
  });
}

/** Writes the project's current endpoints back out as an OpenAPI document. */
export async function exportSpec({ args, cwd }: CommandContext): Promise<void> {
  const { api, projectId } = client(args, cwd);
  const endpoints = await api.project(projectId).endpoints();

  const paths: Record<string, Record<string, unknown>> = {};
  for (const endpoint of endpoints) {
    const method = endpoint.method.toLowerCase();
    paths[endpoint.path] ??= {};
    paths[endpoint.path][method] = {
      description: endpoint.description ?? undefined,
      responses: {
        [String(endpoint.responses[0]?.statusCode ?? 200)]: {
          description: 'Mocked by MockFlow',
          content: {
            'application/json': { example: endpoint.responses[0]?.body },
          },
        },
      },
      'x-mockflow': {
        stateful: endpoint.stateful,
        failureRules: endpoint.failureRules ?? [],
      },
    };
  }

  const document = {
    openapi: '3.0.0',
    info: { title: 'MockFlow export', version: '1.0.0' },
    paths,
  };

  const out = flagString(args.flags, 'out');
  if (out) {
    writeFileSync(resolve(cwd, out), `${JSON.stringify(document, null, 2)}\n`);
    console.log(`Wrote ${endpoints.length} endpoint(s) to ${out}`);
    return;
  }
  console.log(JSON.stringify(document, null, 2));
}

/** Recent requests, newest last so a tail reads top to bottom. */
export async function logs({ args, cwd }: CommandContext): Promise<void> {
  const { api, projectId } = client(args, cwd);
  const entries = await api
    .project(projectId)
    .logs(flagNumber(args.flags, 'limit', 20));

  for (const entry of [...entries].reverse()) {
    const failure = entry.failureType ? `  [${entry.failureType}]` : '';
    console.log(
      `${entry.createdAt}  ${entry.method.padEnd(6)} ${entry.path.padEnd(28)} ${String(
        entry.statusCode,
      ).padEnd(4)} ${String(entry.latencyMs).padStart(5)}ms${failure}`,
    );
  }
  if (entries.length === 0) console.log('No requests yet.');
}

/**
 * Sets failure rules from a compact spec: `error:10 slow:20@2000 timeout:5`.
 * Typing JSON on a command line is nobody's idea of a good time.
 */
export function parseChaos(specs: string[]): FailureRule[] {
  return specs.map((spec) => {
    const [head, delay] = spec.split('@');
    const [type, percent] = head.split(':');
    if (!type || percent === undefined) {
      throw new Error(`Bad rule "${spec}" — expected <type>:<percent>[@delayMs]`);
    }
    const rule: FailureRule = {
      type: type as FailureType,
      percent: Number(percent),
    };
    if (delay !== undefined) rule.delayMs = Number(delay);
    return rule;
  });
}

export async function chaos({ args, cwd }: CommandContext): Promise<void> {
  const { api, projectId } = client(args, cwd);
  const [pathFilter, ...rules] = args.positionals;
  if (!pathFilter) {
    throw new Error('Usage: mockflow chaos <path> <type:percent[@delayMs]>...');
  }

  const project = api.project(projectId);
  const endpoints = await project.endpoints();
  const matches = endpoints.filter((e) => e.path === pathFilter);
  if (matches.length === 0) {
    throw new Error(`No endpoint matches ${pathFilter}`);
  }

  const parsed = parseChaos(rules);
  for (const endpoint of matches) {
    await project.setFailureRules(endpoint.id, parsed);
    console.log(
      `${endpoint.method} ${endpoint.path} -> ${
        parsed.length
          ? parsed.map((r) => `${r.percent}% ${r.type}`).join(', ')
          : 'no failures'
      }`,
    );
  }
}

export function help(): void {
  console.log(`mockflow — the MockFlow CLI

Usage
  mockflow init [--api <url>] [--project <id>] [--spec <file>]
  mockflow deploy [spec.json]            Upload a spec to the project
  mockflow start  [spec.json]            Upload, then re-upload on every change
  mockflow export [--out <file>]         Write current endpoints back as OpenAPI
  mockflow logs   [--limit <n>]          Show recent mock requests
  mockflow chaos  <path> <rules...>      e.g. chaos /orders error:10 slow:20@2000

Credentials come from the environment:
  MOCKFLOW_TOKEN     a JWT access token
  MOCKFLOW_API_KEY   a workspace API key

Settings resolve from flags, then ${CONFIG_FILE}, then the environment.`);
}

export function describeError(err: unknown): string {
  if (err instanceof MockFlowError) {
    return `${err.message}${err.retryable ? ' (retryable)' : ''}`;
  }
  return err instanceof Error ? err.message : String(err);
}
