export interface ParsedArgs {
  command: string;
  positionals: string[];
  flags: Record<string, string | boolean>;
}

/**
 * Small argv parser — the CLI has a handful of flags and pulling in a framework
 * for them would be more dependency than the feature is worth.
 *
 * Supports `--flag value`, `--flag=value`, boolean `--flag`, and `--no-flag`.
 */
export function parseArgs(argv: string[]): ParsedArgs {
  const [command = 'help', ...rest] = argv;
  const positionals: string[] = [];
  const flags: Record<string, string | boolean> = {};

  for (let i = 0; i < rest.length; i++) {
    const token = rest[i];

    if (!token.startsWith('--')) {
      positionals.push(token);
      continue;
    }

    const body = token.slice(2);
    if (body.includes('=')) {
      const [name, ...value] = body.split('=');
      flags[name] = value.join('=');
      continue;
    }
    if (body.startsWith('no-')) {
      flags[body.slice(3)] = false;
      continue;
    }

    const next = rest[i + 1];
    if (next !== undefined && !next.startsWith('--')) {
      flags[body] = next;
      i++;
    } else {
      flags[body] = true;
    }
  }

  return { command, positionals, flags };
}

/** Reads a flag as a string, falling back when it's absent or a bare boolean. */
export function flagString(
  flags: ParsedArgs['flags'],
  name: string,
  fallback?: string,
): string | undefined {
  const value = flags[name];
  return typeof value === 'string' ? value : fallback;
}

export function flagNumber(
  flags: ParsedArgs['flags'],
  name: string,
  fallback: number,
): number {
  const value = Number(flagString(flags, name));
  return Number.isFinite(value) ? value : fallback;
}
