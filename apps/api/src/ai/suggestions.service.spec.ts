import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { SuggestionsService } from './suggestions.service';
import { RealisticGenerator } from './realistic-generator.service';

const service = new SuggestionsService(new RealisticGenerator());

const orderItem = {
  type: 'object',
  required: ['customerName', 'email', 'total'],
  properties: {
    id: { type: 'string', format: 'uuid' },
    customerName: { type: 'string' },
    email: { type: 'string', format: 'email' },
    total: { type: 'number', minimum: 1 },
    status: { type: 'string', enum: ['pending', 'shipped', 'cancelled'] },
  },
};

const listSchema = { type: 'array', items: orderItem };

describe('SuggestionsService examples', () => {
  it('offers empty, single and full-page variants for a list', () => {
    const { examples } = service.build('GET', '/orders', listSchema, null);
    expect(examples.map((e) => e.name)).toEqual([
      'empty',
      'single item',
      'full page',
    ]);
    expect(examples[0].body).toEqual([]);
    expect(examples[1].body).toHaveLength(1);
    expect(examples[2].body).toHaveLength(10);
  });

  it('offers a typical and a not-found variant for a single resource', () => {
    const { examples } = service.build('GET', '/orders/{id}', orderItem, null);
    expect(examples.map((e) => e.statusCode)).toEqual([200, 404]);
  });
});

describe('SuggestionsService validation rules', () => {
  const { validationRules } = service.build('POST', '/orders', orderItem, null);
  const find = (field: string, prefix: string) =>
    validationRules.find((r) => r.field === field && r.rule.startsWith(prefix));

  it('marks every required field', () => {
    for (const field of ['customerName', 'email', 'total']) {
      expect(find(field, 'required'), field).toBeDefined();
    }
    expect(find('id', 'required')).toBeUndefined();
  });

  it('carries formats, enums and ranges through', () => {
    expect(find('email', 'format')?.rule).toBe('format:email');
    expect(find('status', 'enum')?.rule).toBe('enum:pending|shipped|cancelled');
    expect(find('total', 'range')?.rule).toBe('range:1..∞');
  });

  it('uses the right article in type messages', () => {
    expect(find('customerName', 'type')?.message).toBe(
      'customerName must be a string',
    );
    expect(
      service
        .build('POST', '/x', { type: 'object', properties: { n: { type: 'integer' } } }, null)
        .validationRules.find((r) => r.rule === 'type:integer')?.message,
    ).toBe('n must be an integer');
  });
});

describe('SuggestionsService test cases', () => {
  it('covers the happy path and one omission per required field', () => {
    const { testCases } = service.build('POST', '/orders', orderItem, null);
    expect(testCases[0]).toMatchObject({ expectStatus: 201 });
    for (const field of ['customerName', 'email', 'total']) {
      const omission = testCases.find(
        (t) => t.name === `rejects a body missing ${field}`,
      );
      expect(omission, field).toBeDefined();
      expect(omission!.expectStatus).toBe(400);
      expect(omission!.body).not.toHaveProperty(field);
    }
  });

  it('adds a 404 case only when the path takes a parameter', () => {
    const withParam = service.build('GET', '/orders/{id}', orderItem, null);
    const without = service.build('GET', '/orders', orderItem, null);
    expect(withParam.testCases.some((t) => t.expectStatus === 404)).toBe(true);
    expect(
      without.testCases.some((t) => t.name === 'returns 404 for an unknown id'),
    ).toBe(false);
  });

  it('adds a pagination case only for list responses', () => {
    expect(
      service
        .build('GET', '/orders', listSchema, null)
        .testCases.some((t) => t.name === 'paginates'),
    ).toBe(true);
    expect(
      service
        .build('GET', '/orders/{id}', orderItem, null)
        .testCases.some((t) => t.name === 'paginates'),
    ).toBe(false);
  });

  it('derives a case per failure type the endpoint actually injects', () => {
    const { testCases } = service.build('GET', '/orders', listSchema, null, [
      'error',
      'db_down',
    ]);
    expect(
      testCases.find((t) => t.name.includes('injected error'))?.expectStatus,
    ).toBe(500);
    expect(
      testCases.find((t) => t.name.includes('injected db_down'))?.expectStatus,
    ).toBe(503);
  });

  it('prefers the request schema over the response when the spec has one', () => {
    const requestSchema = {
      type: 'object',
      required: ['sku'],
      properties: { sku: { type: 'string' } },
    };
    const { validationRules } = service.build(
      'POST',
      '/orders',
      listSchema,
      requestSchema,
    );
    expect(validationRules.some((r) => r.field === 'sku')).toBe(true);
    expect(validationRules.some((r) => r.field === 'customerName')).toBe(false);
  });
});
