import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { RealisticGenerator } from './realistic-generator.service';
import { CATEGORIES } from './catalog';

const generator = new RealisticGenerator();

const productSchema = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      productName: { type: 'string' },
      category: { type: 'string' },
      subcategory: { type: 'string' },
      brand: { type: 'string' },
      price: { type: 'number' },
      stock: { type: 'integer' },
      inStock: { type: 'boolean' },
      createdAt: { type: 'string', format: 'date-time' },
    },
  },
};

describe('RealisticGenerator', () => {
  it('returns one item per requested count for a list schema', () => {
    const items = generator.generate(productSchema, { count: 7 }) as unknown[];
    expect(items).toHaveLength(7);
  });

  it('is deterministic for a given seed', () => {
    const a = generator.generate(productSchema, { count: 3, seed: 42 });
    const b = generator.generate(productSchema, { count: 3, seed: 42 });
    expect(a).toEqual(b);
  });

  it('produces different data for a different seed', () => {
    const a = generator.generate(productSchema, { count: 3, seed: 1 });
    const b = generator.generate(productSchema, { count: 3, seed: 99 });
    expect(a).not.toEqual(b);
  });

  it('keeps brand and subcategory consistent with the category', () => {
    const items = generator.generate(productSchema, { count: 20 }) as Array<
      Record<string, string>
    >;
    for (const item of items) {
      const spec = CATEGORIES.find((c) => c.name === item.category);
      expect(spec, `unknown category ${item.category}`).toBeDefined();
      expect(spec!.brands).toContain(item.brand);
      expect(spec!.subcategories).toContain(item.subcategory);
    }
  });

  it('names a product with the same brand it reports', () => {
    const items = generator.generate(productSchema, { count: 20 }) as Array<
      Record<string, string>
    >;
    for (const item of items) {
      // Books are titled without their publisher, so only the rest must match.
      if (item.category === 'Books') continue;
      expect(item.productName.startsWith(item.brand)).toBe(true);
    }
  });

  it('prices within the band its category declares', () => {
    const items = generator.generate(productSchema, { count: 20 }) as Array<
      Record<string, any>
    >;
    for (const item of items) {
      const spec = CATEGORIES.find((c) => c.name === item.category)!;
      expect(item.price).toBeGreaterThanOrEqual(spec.price[0]);
      expect(item.price).toBeLessThanOrEqual(spec.price[1]);
    }
  });

  it('derives an email from the name in the same record', () => {
    const people = generator.generate(
      {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            email: { type: 'string', format: 'email' },
          },
        },
      },
      { count: 10 },
    ) as Array<Record<string, string>>;

    for (const person of people) {
      expect(person.email).toBe(
        `${person.firstName.toLowerCase()}.${person.lastName.toLowerCase()}@${
          person.email.split('@')[1]
        }`,
      );
    }
  });

  it('honours explicit examples and enums from the spec', () => {
    const out = generator.generate({
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['shipped', 'returned'] },
        fixed: { type: 'string', example: 'always-this' },
      },
    }) as Record<string, string>;
    expect(['shipped', 'returned']).toContain(out.status);
    expect(out.fixed).toBe('always-this');
  });

  it('respects numeric minimum and maximum', () => {
    const out = generator.generate(
      {
        type: 'object',
        properties: { rating: { type: 'integer', minimum: 1, maximum: 5 } },
      },
      { count: 1 },
    ) as Record<string, number>;
    expect(out.rating).toBeGreaterThanOrEqual(1);
    expect(out.rating).toBeLessThanOrEqual(5);
  });

  it('formats uuid and date-time fields correctly', () => {
    const out = generator.generate({
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        createdAt: { type: 'string', format: 'date-time' },
      },
    }) as Record<string, string>;
    expect(out.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-a[0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(Number.isNaN(Date.parse(out.createdAt))).toBe(false);
  });

  it('never emits placeholder values like "string"', () => {
    const json = JSON.stringify(
      generator.generate(productSchema, { count: 30 }),
    );
    expect(json).not.toMatch(/"string"|"foo"|"bar"|null/);
  });

  it('caps the item count instead of generating unbounded data', () => {
    const items = generator.generate(productSchema, { count: 5_000 }) as unknown[];
    expect(items).toHaveLength(100);
  });
});
