import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { FailureService } from './failure.service';
import { FailureRule } from './failure.types';

/** A service whose rolls are fully controlled by the test. */
function serviceRolling(...rolls: number[]): FailureService {
  const service = new FailureService();
  let i = 0;
  service.random = () => rolls[Math.min(i++, rolls.length - 1)] ?? 0;
  return service;
}

describe('FailureService.pick', () => {
  const rules: FailureRule[] = [
    { type: 'error', percent: 10 },
    { type: 'slow', percent: 20 },
  ];

  it('returns null when there are no rules', () => {
    expect(serviceRolling(0).pick([])).toBeNull();
  });

  it('fires the first rule inside its share of the range', () => {
    // roll = 5% -> inside error's 0–10 window
    expect(serviceRolling(0.05).pick(rules)?.type).toBe('error');
  });

  it('fires the second rule inside its share of the range', () => {
    // roll = 25% -> past error (10), inside slow's 10–30 window
    expect(serviceRolling(0.25).pick(rules)?.type).toBe('slow');
  });

  it('leaves the request healthy beyond the cumulative percentage', () => {
    // roll = 50% -> past both windows
    expect(serviceRolling(0.5).pick(rules)).toBeNull();
  });

  it('treats the window as half-open at the boundary', () => {
    // roll = exactly 10% belongs to `slow`, not `error`
    expect(serviceRolling(0.1).pick(rules)?.type).toBe('slow');
  });

  it('skips disabled and zero-percent rules', () => {
    const picked = serviceRolling(0.01).pick([
      { type: 'error', percent: 50, enabled: false },
      { type: 'network', percent: 0 },
      { type: 'db_down', percent: 10 },
    ]);
    expect(picked?.type).toBe('db_down');
  });

  it('honours a rule that covers the whole range', () => {
    const always: FailureRule[] = [{ type: 'timeout', percent: 100 }];
    expect(serviceRolling(0.999).pick(always)?.type).toBe('timeout');
  });
});

describe('FailureService.normalize', () => {
  const service = new FailureService();

  it('accepts an empty or missing list', () => {
    expect(service.normalize(undefined)).toEqual([]);
    expect(service.normalize(null)).toEqual([]);
    expect(service.normalize([])).toEqual([]);
  });

  it('keeps known fields and drops unknown ones', () => {
    expect(
      service.normalize([
        { type: 'error', percent: 10, statusCode: 503, junk: 'x' },
      ]),
    ).toEqual([{ type: 'error', percent: 10, statusCode: 503 }]);
  });

  it('rejects an unknown failure type', () => {
    expect(() => service.normalize([{ type: 'meltdown', percent: 5 }])).toThrow(
      /not a known failure type/,
    );
  });

  it('rejects an out-of-range percentage', () => {
    expect(() => service.normalize([{ type: 'error', percent: 140 }])).toThrow(
      /between 0 and 100/,
    );
  });

  it('rejects enabled rules totalling more than 100%', () => {
    expect(() =>
      service.normalize([
        { type: 'error', percent: 70 },
        { type: 'slow', percent: 50 },
      ]),
    ).toThrow(/exceeds 100%/);
  });

  it('ignores disabled rules when totalling', () => {
    expect(
      service.normalize([
        { type: 'error', percent: 70 },
        { type: 'slow', percent: 50, enabled: false },
      ]),
    ).toHaveLength(2);
  });

  it('caps an absurd delay instead of accepting it', () => {
    const [rule] = service.normalize([
      { type: 'slow', percent: 1, delayMs: 9_999_999 },
    ]);
    expect(rule.delayMs).toBe(120_000);
  });

  it('rejects a negative delay', () => {
    expect(() =>
      service.normalize([{ type: 'slow', percent: 1, delayMs: -5 }]),
    ).toThrow(/delayMs must be >= 0/);
  });
});

describe('FailureService.parse', () => {
  const service = new FailureService();

  it('skips malformed rules instead of throwing', () => {
    const parsed = service.parse([
      { type: 'error', percent: 10 },
      { type: 'nonsense', percent: 10 },
      'not-an-object',
    ]);
    expect(parsed).toEqual([{ type: 'error', percent: 10 }]);
  });

  it('returns an empty list for a non-array column value', () => {
    expect(service.parse(null)).toEqual([]);
    expect(service.parse({ type: 'error' })).toEqual([]);
  });
});

describe('FailureService responses', () => {
  const service = new FailureService();

  it('defaults an error rule to 500', () => {
    expect(service.statusFor({ type: 'error', percent: 1 })).toBe(500);
  });

  it('uses the configured status when given', () => {
    expect(
      service.statusFor({ type: 'error', percent: 1, statusCode: 429 }),
    ).toBe(429);
  });

  it('maps timeout and db_down to their fixed statuses', () => {
    expect(service.statusFor({ type: 'timeout', percent: 1 })).toBe(504);
    expect(service.statusFor({ type: 'db_down', percent: 1 })).toBe(503);
  });

  it('defaults delays per type and honours overrides', () => {
    expect(service.delayFor({ type: 'slow', percent: 1 })).toBe(1_000);
    expect(service.delayFor({ type: 'timeout', percent: 1 })).toBe(30_000);
    expect(service.delayFor({ type: 'slow', percent: 1, delayMs: 250 })).toBe(250);
    expect(service.delayFor({ type: 'error', percent: 1 })).toBe(0);
  });

  it('prefers a caller-supplied body over the canned one', () => {
    const body = { oops: true };
    expect(service.bodyFor({ type: 'error', percent: 1, body })).toBe(body);
    expect(service.bodyFor({ type: 'db_down', percent: 1 })).toMatchObject({
      error: 'ServiceUnavailable',
    });
  });
});
