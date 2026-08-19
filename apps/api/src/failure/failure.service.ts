import { BadRequestException, Injectable } from '@nestjs/common';
import {
  DB_DOWN_STATUS,
  DEFAULT_DELAY_MS,
  FailureRule,
  MAX_DELAY_MS,
  TIMEOUT_STATUS,
  isFailureType,
} from './failure.types';

/**
 * Decides whether a given request should be sabotaged, and how.
 *
 * Rules are evaluated with a single roll over their cumulative percentages, so
 * at most one rule fires per request and the percentages read the way people
 * expect: `[{error,10},{slow,20}]` means 10% error, 20% slow, 70% healthy.
 */
@Injectable()
export class FailureService {
  /** Source of randomness in [0, 1). Replaced in tests for determinism. */
  random: () => number = Math.random;

  /**
   * Validates rules coming from the API and fills in defaults. Throws on
   * anything malformed so bad config fails loudly at write time.
   */
  normalize(input: unknown): FailureRule[] {
    if (input === null || input === undefined) return [];
    if (!Array.isArray(input)) {
      throw new BadRequestException('failureRules must be an array');
    }

    const rules = input.map((raw, i) => this.normalizeOne(raw, i));

    const total = rules
      .filter((r) => r.enabled !== false)
      .reduce((sum, r) => sum + r.percent, 0);
    if (total > 100) {
      throw new BadRequestException(
        `Enabled failure rules total ${total}%, which exceeds 100%`,
      );
    }

    return rules;
  }

  /**
   * Reads rules back out of the database column. Unlike `normalize` this is
   * forgiving — anything unrecognised is skipped rather than thrown, so a bad
   * row can never take the mock plane down.
   */
  parse(stored: unknown): FailureRule[] {
    if (!Array.isArray(stored)) return [];
    const rules: FailureRule[] = [];
    for (const [i, raw] of stored.entries()) {
      try {
        rules.push(this.normalizeOne(raw, i));
      } catch {
        /* skip malformed rule */
      }
    }
    return rules;
  }

  /** Rolls once and returns the rule that fired, or null for a healthy request. */
  pick(rules: FailureRule[]): FailureRule | null {
    const active = rules.filter((r) => r.enabled !== false && r.percent > 0);
    if (active.length === 0) return null;

    const roll = this.random() * 100;
    let cursor = 0;
    for (const rule of active) {
      cursor += rule.percent;
      if (roll < cursor) return rule;
    }
    return null;
  }

  /** How long a rule should stall, in milliseconds (0 for non-stalling types). */
  delayFor(rule: FailureRule): number {
    if (rule.type !== 'slow' && rule.type !== 'timeout') return 0;
    return rule.delayMs ?? DEFAULT_DELAY_MS[rule.type];
  }

  /** The status a rule answers with, ignoring `network` (which never replies). */
  statusFor(rule: FailureRule): number {
    switch (rule.type) {
      case 'error':
        return rule.statusCode ?? 500;
      case 'timeout':
        return TIMEOUT_STATUS;
      case 'db_down':
        return DB_DOWN_STATUS;
      default:
        return 200;
    }
  }

  /** The body a rule answers with, unless the caller configured its own. */
  bodyFor(rule: FailureRule): unknown {
    if (rule.body !== undefined) return rule.body;
    switch (rule.type) {
      case 'timeout':
        return {
          error: 'GatewayTimeout',
          message: 'Upstream did not respond in time (simulated by MockFlow)',
        };
      case 'db_down':
        return {
          error: 'ServiceUnavailable',
          message: 'Database connection failed (simulated by MockFlow)',
        };
      default:
        return {
          error: 'InjectedFailure',
          message: `MockFlow injected a simulated "${rule.type}" failure`,
        };
    }
  }

  sleep(ms: number): Promise<void> {
    if (ms <= 0) return Promise.resolve();
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private normalizeOne(raw: unknown, index: number): FailureRule {
    const at = `failureRules[${index}]`;
    if (typeof raw !== 'object' || raw === null) {
      throw new BadRequestException(`${at} must be an object`);
    }
    const input = raw as Record<string, unknown>;

    if (!isFailureType(input.type)) {
      throw new BadRequestException(`${at}.type is not a known failure type`);
    }
    const percent = Number(input.percent);
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
      throw new BadRequestException(`${at}.percent must be between 0 and 100`);
    }

    const rule: FailureRule = { type: input.type, percent };

    if (input.enabled !== undefined) rule.enabled = Boolean(input.enabled);
    if (input.body !== undefined) rule.body = input.body;

    if (input.statusCode !== undefined) {
      const statusCode = Number(input.statusCode);
      if (!Number.isInteger(statusCode) || statusCode < 100 || statusCode > 599) {
        throw new BadRequestException(`${at}.statusCode must be 100–599`);
      }
      rule.statusCode = statusCode;
    }

    if (input.delayMs !== undefined) {
      const delayMs = Number(input.delayMs);
      if (!Number.isFinite(delayMs) || delayMs < 0) {
        throw new BadRequestException(`${at}.delayMs must be >= 0`);
      }
      rule.delayMs = Math.min(Math.round(delayMs), MAX_DELAY_MS);
    }

    return rule;
  }
}
