import { Injectable } from '@nestjs/common';
import {
  CATEGORIES,
  CategorySpec,
  CITIES,
  EMAIL_DOMAINS,
  FIRST_NAMES,
  LAST_NAMES,
  LOREM,
  PRODUCT_NOUNS,
  STATUSES,
  STREETS,
} from './catalog';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Per-object scratchpad. Fields are generated lazily but share these, so the
 * email in a record matches its name and the brand matches its category —
 * the difference between mock data you can demo and mock data you can't.
 */
interface ItemContext {
  person?: { first: string; last: string };
  product?: {
    spec: CategorySpec;
    subcategory: string;
    brand: string;
    name: string;
  };
  city?: string[];
}

/**
 * Generates believable response bodies from a JSON schema, without calling out
 * to a model. Field names carry most of the signal — `email` should look like
 * an email, `price` like a price — so names are consulted before types.
 *
 * Deterministic for a given seed: the same endpoint regenerates the same data
 * until someone asks for something different.
 */
@Injectable()
export class RealisticGenerator {
  /** Generates one body, or an array of `count` items if the schema is a list. */
  generate(schema: any, options: { count?: number; seed?: number } = {}): unknown {
    const rng = this.rngFor(options.seed ?? 1);
    const count = Math.min(Math.max(options.count ?? 5, 1), 100);

    if (schema?.type === 'array' || Array.isArray(schema?.items)) {
      return Array.from({ length: count }, () =>
        this.build(schema.items ?? {}, rng, {}, 'item'),
      );
    }
    return this.build(schema ?? {}, rng, {}, '');
  }

  /** Mulberry32 — small, fast, and repeatable across runs. */
  private rngFor(seed: number): () => number {
    let a = (seed >>> 0) || 1;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  private pick<T>(items: readonly T[], rng: () => number): T {
    return items[Math.floor(rng() * items.length)] as T;
  }

  private int(rng: () => number, min: number, max: number): number {
    return Math.floor(rng() * (max - min + 1)) + min;
  }

  private build(
    schema: any,
    rng: () => number,
    ctx: ItemContext,
    field: string,
  ): unknown {
    if (schema && typeof schema === 'object') {
      // An explicit example or enum in the spec always wins — the author of the
      // spec knows better than our guesses.
      if (schema.example !== undefined) return schema.example;
      if (Array.isArray(schema.enum) && schema.enum.length) {
        return this.pick(schema.enum, rng);
      }
    }

    const type =
      schema?.type ?? (schema?.properties ? 'object' : this.guessType(field));

    switch (type) {
      case 'object': {
        const out: Record<string, unknown> = {};
        const nested: ItemContext = {};
        for (const [key, value] of Object.entries<any>(schema?.properties ?? {})) {
          out[key] = this.build(value, rng, nested, key);
        }
        return out;
      }
      case 'array': {
        const length = this.int(rng, 1, 3);
        return Array.from({ length }, () =>
          this.build(schema?.items ?? {}, rng, {}, field),
        );
      }
      case 'boolean':
        return this.boolean(field, rng);
      case 'integer':
      case 'number':
        return this.number(field, schema, rng, ctx, type === 'integer');
      default:
        return this.string(field, schema, rng, ctx);
    }
  }

  /** Schemas in the wild often omit `type`; the field name is the next best clue. */
  private guessType(field: string): string {
    const f = field.toLowerCase();
    if (/^(is|has|can)[A-Z_]?|active|enabled|verified|deleted/i.test(field)) {
      return 'boolean';
    }
    if (/(count|quantity|stock|age|total|amount|price|rating|qty)/.test(f)) {
      return 'number';
    }
    return 'string';
  }

  private boolean(field: string, rng: () => number): boolean {
    const f = field.toLowerCase();
    // Flags that are usually true in real data shouldn't be a coin flip.
    if (/(active|enabled|available|instock|verified)/.test(f)) return rng() > 0.2;
    if (/(deleted|archived|banned|suspended)/.test(f)) return rng() > 0.9;
    return rng() > 0.5;
  }

  private number(
    field: string,
    schema: any,
    rng: () => number,
    ctx: ItemContext,
    integer: boolean,
  ): number {
    const f = field.toLowerCase();
    const min = schema?.minimum;
    const max = schema?.maximum;
    if (typeof min === 'number' && typeof max === 'number') {
      const value = min + rng() * (max - min);
      return integer ? Math.round(value) : Number(value.toFixed(2));
    }

    if (/(price|amount|total|cost|mrp|subtotal)/.test(f)) {
      const product = this.product(ctx, rng);
      const [low, high] = product.spec.price;
      const value = low + rng() * (high - low);
      return Number(value.toFixed(2));
    }
    if (/(rating|score|stars)/.test(f)) return Number((3 + rng() * 2).toFixed(1));
    if (/(discount|percent|tax)/.test(f)) return this.int(rng, 0, 30);
    if (/(stock|quantity|qty|available)/.test(f)) return this.int(rng, 0, 500);
    if (/(age)/.test(f)) return this.int(rng, 18, 72);
    if (/(count|total|views|likes)/.test(f)) return this.int(rng, 0, 10_000);
    if (/id$/.test(f)) return this.int(rng, 1, 9_999);

    const value = rng() * 1_000;
    return integer ? Math.round(value) : Number(value.toFixed(2));
  }

  private string(
    field: string,
    schema: any,
    rng: () => number,
    ctx: ItemContext,
  ): string {
    const f = field.toLowerCase();
    const format = schema?.format;

    if (format === 'uuid' || /^(id|uuid|guid)$/.test(f)) return this.uuid(rng);
    if (format === 'date') return this.date(rng).slice(0, 10);
    if (format === 'date-time' || /(at|date|timestamp)$/.test(f)) {
      return this.date(rng);
    }
    if (format === 'email' || /mail/.test(f)) return this.email(ctx, rng);
    if (format === 'uri' || format === 'url' || /(url|link|website)/.test(f)) {
      return `https://example.com/${this.slug(this.product(ctx, rng).name)}`;
    }
    if (/(image|photo|avatar|thumbnail|picture)/.test(f)) {
      return `https://cdn.example.com/img/${this.uuid(rng).slice(0, 8)}.jpg`;
    }
    if (/phone|mobile|contact/.test(f)) {
      return `+91 9${this.int(rng, 100000000, 999999999)}`;
    }

    if (/firstname|givenname/.test(f)) return this.person(ctx, rng).first;
    if (/lastname|surname|familyname/.test(f)) return this.person(ctx, rng).last;
    if (/(username|handle|login)/.test(f)) {
      const person = this.person(ctx, rng);
      return `${person.first.toLowerCase()}.${person.last.toLowerCase()}`;
    }
    if (/(customer|user|author|owner|member|person|full)?name$/.test(f)) {
      // "name" on a product record means the product, not a person.
      if (/product|item|brand|category|store|company/.test(f)) {
        return this.product(ctx, rng).name;
      }
      const person = this.person(ctx, rng);
      return `${person.first} ${person.last}`;
    }

    // "subcategory" contains "category", so the narrower test has to come first.
    if (/(subcategory|sub_category|department|section)/.test(f)) {
      return this.product(ctx, rng).subcategory;
    }
    if (/category/.test(f)) return this.product(ctx, rng).spec.name;
    if (/(brand|manufacturer|vendor|seller)/.test(f)) {
      return this.product(ctx, rng).brand;
    }
    if (/(title|product|item)/.test(f)) return this.product(ctx, rng).name;
    if (/(sku|code|reference|ref)/.test(f)) {
      return `${this.product(ctx, rng).spec.name.slice(0, 3).toUpperCase()}-${this.int(rng, 1000, 9999)}`;
    }
    if (/(currency)/.test(f)) return this.pick(['INR', 'USD', 'EUR'], rng);
    if (/(status|state)/.test(f)) return this.pick(STATUSES, rng);
    if (/(description|summary|bio|notes?|comment)/.test(f)) {
      return this.pick(LOREM, rng);
    }

    if (/(street|address|line1)/.test(f)) {
      return `${this.int(rng, 1, 220)}, ${this.pick(STREETS, rng)}`;
    }
    if (/city|town/.test(f)) return this.city(ctx, rng)[0] as string;
    if (/state|province|region/.test(f)) return this.city(ctx, rng)[1] as string;
    if (/(zip|postal|pincode)/.test(f)) return this.city(ctx, rng)[2] as string;
    if (/country/.test(f)) return 'India';

    if (typeof schema?.minLength === 'number' && schema.minLength > 24) {
      return this.pick(LOREM, rng);
    }
    return field ? `${field}-${this.int(rng, 100, 999)}` : this.pick(LOREM, rng);
  }

  private person(ctx: ItemContext, rng: () => number) {
    ctx.person ??= {
      first: this.pick(FIRST_NAMES, rng),
      last: this.pick(LAST_NAMES, rng),
    };
    return ctx.person;
  }

  private email(ctx: ItemContext, rng: () => number): string {
    const person = this.person(ctx, rng);
    return `${person.first.toLowerCase()}.${person.last.toLowerCase()}@${this.pick(EMAIL_DOMAINS, rng)}`;
  }

  private product(ctx: ItemContext, rng: () => number) {
    if (!ctx.product) {
      const spec = this.pick(CATEGORIES, rng);
      const subcategory = this.pick(spec.subcategories, rng);
      const nouns = PRODUCT_NOUNS[subcategory] ?? [subcategory];
      const noun = this.pick(nouns, rng);
      // One brand per item: the `brand` field and the brand inside the product
      // name have to agree, or the record contradicts itself.
      const brand = this.pick(spec.brands, rng);
      // Books read oddly with a publisher in front of the title.
      const name = spec.name === 'Books' ? noun : `${brand} ${noun}`;
      ctx.product = { spec, subcategory, brand, name };
    }
    return ctx.product;
  }

  private city(ctx: ItemContext, rng: () => number): string[] {
    ctx.city ??= this.pick(CITIES, rng);
    return ctx.city;
  }

  private uuid(rng: () => number): string {
    const hex = '0123456789abcdef';
    let out = '';
    for (let i = 0; i < 32; i++) out += hex[Math.floor(rng() * 16)];
    return [
      out.slice(0, 8),
      out.slice(8, 12),
      `4${out.slice(13, 16)}`,
      `a${out.slice(17, 20)}`,
      out.slice(20, 32),
    ].join('-');
  }

  private date(rng: () => number): string {
    // Somewhere in the last 90 days, so timestamps look recent but not identical.
    const now = Date.UTC(2026, 0, 1);
    const offset = Math.floor(rng() * 90 * 24 * 3600 * 1000);
    return new Date(now + offset).toISOString();
  }

  private slug(value: string): string {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
}
