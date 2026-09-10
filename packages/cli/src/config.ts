import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const CONFIG_FILE = 'mockflow.json';

export interface MockFlowConfig {
  apiUrl: string;
  projectId?: string;
  /** Spec file kept in sync with the project. */
  spec?: string;
}

export const DEFAULT_API_URL = 'http://localhost:4000';

export function configPath(cwd = process.cwd()): string {
  return resolve(cwd, CONFIG_FILE);
}

export function readConfig(cwd = process.cwd()): MockFlowConfig | null {
  const path = configPath(cwd);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf8')) as MockFlowConfig;
}

export function writeConfig(config: MockFlowConfig, cwd = process.cwd()): string {
  const path = configPath(cwd);
  writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`);
  return path;
}

/**
 * Resolves settings from flags, then the config file, then the environment.
 *
 * Credentials are read only from the environment — writing a token into
 * mockflow.json would put it one `git add` away from being published.
 */
export function resolveSettings(
  flags: Record<string, string | boolean>,
  config: MockFlowConfig | null,
  env: NodeJS.ProcessEnv = process.env,
): {
  apiUrl: string;
  projectId?: string;
  spec?: string;
  token?: string;
  apiKey?: string;
} {
  const flag = (name: string): string | undefined =>
    typeof flags[name] === 'string' ? (flags[name] as string) : undefined;

  return {
    apiUrl: flag('api') ?? config?.apiUrl ?? env.MOCKFLOW_API_URL ?? DEFAULT_API_URL,
    projectId: flag('project') ?? config?.projectId ?? env.MOCKFLOW_PROJECT,
    spec: flag('spec') ?? config?.spec,
    token: env.MOCKFLOW_TOKEN,
    apiKey: env.MOCKFLOW_API_KEY,
  };
}
