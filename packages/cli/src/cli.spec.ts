import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { flagNumber, flagString, parseArgs } from './args';
import {
  DEFAULT_API_URL,
  readConfig,
  resolveSettings,
  writeConfig,
} from './config';
import { parseChaos } from './commands';

describe('parseArgs', () => {
  it('defaults to help with no arguments', () => {
    expect(parseArgs([]).command).toBe('help');
  });

  it('separates the command from its positionals', () => {
    const { command, positionals } = parseArgs(['deploy', 'spec.json']);
    expect(command).toBe('deploy');
    expect(positionals).toEqual(['spec.json']);
  });

  it('reads --flag value', () => {
    expect(parseArgs(['logs', '--limit', '50']).flags).toEqual({ limit: '50' });
  });

  it('reads --flag=value, keeping later equals signs', () => {
    expect(parseArgs(['init', '--api=http://x/y?a=b']).flags).toEqual({
      api: 'http://x/y?a=b',
    });
  });

  it('treats a trailing flag as boolean true', () => {
    expect(parseArgs(['export', '--pretty']).flags).toEqual({ pretty: true });
  });

  it('treats a flag followed by another flag as boolean', () => {
    expect(parseArgs(['export', '--pretty', '--out', 'x.json']).flags).toEqual({
      pretty: true,
      out: 'x.json',
    });
  });

  it('reads --no-flag as false', () => {
    expect(parseArgs(['start', '--no-watch']).flags).toEqual({ watch: false });
  });

  it('keeps positionals that follow flags', () => {
    const { positionals } = parseArgs(['chaos', '/orders', 'error:10', 'slow:20']);
    expect(positionals).toEqual(['/orders', 'error:10', 'slow:20']);
  });
});

describe('flag readers', () => {
  it('falls back when a flag is a bare boolean', () => {
    expect(flagString({ out: true }, 'out', 'default.json')).toBe('default.json');
  });

  it('falls back when a numeric flag is missing or unparseable', () => {
    expect(flagNumber({}, 'limit', 20)).toBe(20);
    expect(flagNumber({ limit: 'lots' }, 'limit', 20)).toBe(20);
    expect(flagNumber({ limit: '75' }, 'limit', 20)).toBe(75);
  });
});

describe('config', () => {
  const dir = () => mkdtempSync(join(tmpdir(), 'mockflow-cli-'));

  it('round-trips through mockflow.json', () => {
    const cwd = dir();
    writeConfig({ apiUrl: 'http://api.test', projectId: 'p1', spec: './s.json' }, cwd);
    expect(readConfig(cwd)).toEqual({
      apiUrl: 'http://api.test',
      projectId: 'p1',
      spec: './s.json',
    });
  });

  it('returns null when there is no config file', () => {
    expect(readConfig(dir())).toBeNull();
  });

  it('writes a trailing newline so the file is diff-friendly', () => {
    const cwd = dir();
    const path = writeConfig({ apiUrl: 'http://api.test' }, cwd);
    expect(readFileSync(path, 'utf8').endsWith('}\n')).toBe(true);
  });
});

describe('resolveSettings precedence', () => {
  const config = { apiUrl: 'http://from-config', projectId: 'p-config' };

  it('prefers a flag over the config file', () => {
    const s = resolveSettings({ api: 'http://from-flag' }, config, {});
    expect(s.apiUrl).toBe('http://from-flag');
  });

  it('prefers the config file over the environment', () => {
    const s = resolveSettings({}, config, { MOCKFLOW_API_URL: 'http://from-env' });
    expect(s.apiUrl).toBe('http://from-config');
  });

  it('falls back to the environment, then to the default', () => {
    expect(resolveSettings({}, null, { MOCKFLOW_API_URL: 'http://env' }).apiUrl).toBe(
      'http://env',
    );
    expect(resolveSettings({}, null, {}).apiUrl).toBe(DEFAULT_API_URL);
  });

  it('takes credentials only from the environment', () => {
    const s = resolveSettings(
      { token: 'from-flag' },
      { apiUrl: 'x', ...({ token: 'from-config' } as any) },
      { MOCKFLOW_TOKEN: 'from-env' },
    );
    expect(s.token).toBe('from-env');
  });
});

describe('parseChaos', () => {
  it('parses type:percent', () => {
    expect(parseChaos(['error:10'])).toEqual([{ type: 'error', percent: 10 }]);
  });

  it('parses an @delay suffix', () => {
    expect(parseChaos(['slow:20@2000'])).toEqual([
      { type: 'slow', percent: 20, delayMs: 2000 },
    ]);
  });

  it('parses several rules at once', () => {
    expect(parseChaos(['error:10', 'timeout:5@30000'])).toHaveLength(2);
  });

  it('returns an empty list, which is how rules get cleared', () => {
    expect(parseChaos([])).toEqual([]);
  });

  it('rejects a rule with no percentage', () => {
    expect(() => parseChaos(['error'])).toThrow(/expected <type>:<percent>/);
  });
});

describe('cli wiring', () => {
  it('writes the spec path it was given during init', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'mockflow-cli-'));
    writeFileSync(join(cwd, 'openapi.json'), '{}');
    writeConfig({ apiUrl: DEFAULT_API_URL, spec: './openapi.json' }, cwd);
    expect(readConfig(cwd)?.spec).toBe('./openapi.json');
  });
});
