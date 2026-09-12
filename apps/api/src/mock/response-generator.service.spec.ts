import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { ResponseGenerator } from './response-generator.service';

const generator = new ResponseGenerator();

describe('ResponseGenerator', () => {
  it('returns an empty object for a missing or non-object schema', () => {
    expect(generator.generate(null)).toEqual({});
    expect(generator.generate('nope')).toEqual({});
  });

  it('prefers an explicit example over synthesising one', () => {
    expect(
      generator.generate({ type: 'object', example: { a: 1 } }),
    ).toEqual({ a: 1 });
  });

  it('uses the first enum value', () => {
    expect(generator.generate({ type: 'string', enum: ['x', 'y'] })).toBe('x');
  });

  it('walks nested objects', () => {
    expect(
      generator.generate({
        type: 'object',
        properties: {
          id: { type: 'integer' },
          nested: { type: 'object', properties: { ok: { type: 'boolean' } } },
        },
      }),
    ).toEqual({ id: 0, nested: { ok: true } });
  });

  it('produces a one-element array from its items schema', () => {
    expect(
      generator.generate({ type: 'array', items: { type: 'integer' } }),
    ).toEqual([0]);
  });

  it('is deterministic — the same schema always gives the same body', () => {
    const schema = {
      type: 'object',
      properties: { a: { type: 'string' }, b: { type: 'number' } },
    };
    expect(generator.generate(schema)).toEqual(generator.generate(schema));
  });
});
