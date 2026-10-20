import { ConfigService } from '@nestjs/config';

export type JwtSecretName = 'JWT_ACCESS_SECRET' | 'JWT_REFRESH_SECRET';

const DEV_FALLBACK: Record<JwtSecretName, string> = {
  JWT_ACCESS_SECRET: 'dev-access-secret',
  JWT_REFRESH_SECRET: 'dev-refresh-secret',
};

/**
 * Reads a JWT signing secret. Outside production a missing value falls back to
 * a fixed dev secret so `pnpm dev` works with no setup; in production that
 * fallback would let anyone mint tokens, so a missing or placeholder secret
 * stops the API from starting instead.
 */
export function jwtSecret(config: ConfigService, name: JwtSecretName): string {
  const value = config.get<string>(name)?.trim();
  const production = config.get<string>('NODE_ENV') === 'production';

  if (!production) return value || DEV_FALLBACK[name];

  if (!value || value.startsWith('change-me') || value === DEV_FALLBACK[name]) {
    throw new Error(`${name} must be set to a real secret when NODE_ENV=production`);
  }
  return value;
}
