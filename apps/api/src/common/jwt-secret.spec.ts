import { describe, expect, it } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { jwtSecret } from './jwt-secret';

function config(env: Record<string, string>): ConfigService {
  return new ConfigService(env);
}

describe('jwtSecret', () => {
  it('falls back to the dev secret outside production', () => {
    expect(jwtSecret(config({}), 'JWT_ACCESS_SECRET')).toBe('dev-access-secret');
  });

  it('returns the configured secret', () => {
    const env = { NODE_ENV: 'production', JWT_REFRESH_SECRET: 's3cr3t-value' };
    expect(jwtSecret(config(env), 'JWT_REFRESH_SECRET')).toBe('s3cr3t-value');
  });

  it('refuses a missing secret in production', () => {
    expect(() => jwtSecret(config({ NODE_ENV: 'production' }), 'JWT_ACCESS_SECRET')).toThrow(
      /JWT_ACCESS_SECRET/,
    );
  });

  it('refuses the .env.example placeholder in production', () => {
    const env = { NODE_ENV: 'production', JWT_ACCESS_SECRET: 'change-me-access-secret' };
    expect(() => jwtSecret(config(env), 'JWT_ACCESS_SECRET')).toThrow();
  });
});
