import { Injectable } from '@nestjs/common';
import { RealisticGenerator } from './realistic-generator.service';

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface ExampleResponse {
  name: string;
  statusCode: number;
  body: unknown;
}

export interface ValidationRule {
  field: string;
  rule: string;
  message: string;
}

export interface TestCase {
  name: string;
  method: string;
  path: string;
  body?: unknown;
  expectStatus: number;
  note?: string;
}

export interface Suggestions {
  examples: ExampleResponse[];
  validationRules: ValidationRule[];
  testCases: TestCase[];
}

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH']);

/**
 * Derives the things people write by hand after importing a spec: a few
 * response variants, the validation rules the schema already implies, and a
 * starting test suite.
 *
 * All of it comes from the schema, so it works with no API key and returns the
 * same answer every time. The model, when configured, adds edge cases on top
 * rather than replacing any of this.
 */
@Injectable()
export class SuggestionsService {
  constructor(private readonly generator: RealisticGenerator) {}

  build(
    method: string,
    path: string,
    responseSchema: any,
    requestSchema: any,
    failureTypes: string[] = [],
  ): Suggestions {
    const isList = responseSchema?.type === 'array';
    const itemSchema = isList ? responseSchema?.items : responseSchema;
    // Write endpoints validate their request body; when a spec didn't describe
    // one, the response item is the closest honest stand-in.
    const subject = requestSchema ?? itemSchema;

    return {
      examples: this.examples(responseSchema, isList),
      validationRules: this.validationRules(subject),
      testCases: this.testCases(method, path, subject, isList, failureTypes),
    };
  }

  private examples(schema: any, isList: boolean): ExampleResponse[] {
    if (isList) {
      return [
        { name: 'empty', statusCode: 200, body: [] },
        {
          name: 'single item',
          statusCode: 200,
          body: this.generator.generate(schema, { count: 1, seed: 7 }),
        },
        {
          name: 'full page',
          statusCode: 200,
          body: this.generator.generate(schema, { count: 10, seed: 13 }),
        },
      ];
    }
    return [
      {
        name: 'typical',
        statusCode: 200,
        body: this.generator.generate(schema, { seed: 7 }),
      },
      {
        name: 'not found',
        statusCode: 404,
        body: { error: 'NotFound', message: 'No such resource' },
      },
    ];
  }

  /** "a string" but "an integer" — the messages are read by people. */
  private article(word: string): string {
    return /^[aeiou]/i.test(word) ? 'an' : 'a';
  }

  private validationRules(schema: any): ValidationRule[] {
    const properties = schema?.properties ?? {};
    const required: string[] = Array.isArray(schema?.required)
      ? schema.required
      : [];
    const rules: ValidationRule[] = [];

    for (const [field, spec] of Object.entries<any>(properties)) {
      if (required.includes(field)) {
        rules.push({
          field,
          rule: 'required',
          message: `${field} is required`,
        });
      }
      if (spec?.type) {
        rules.push({
          field,
          rule: `type:${spec.type}`,
          message: `${field} must be ${this.article(spec.type)} ${spec.type}`,
        });
      }
      if (spec?.format) {
        rules.push({
          field,
          rule: `format:${spec.format}`,
          message: `${field} must be a valid ${spec.format}`,
        });
      }
      if (Array.isArray(spec?.enum)) {
        rules.push({
          field,
          rule: `enum:${spec.enum.join('|')}`,
          message: `${field} must be one of ${spec.enum.join(', ')}`,
        });
      }
      if (typeof spec?.minimum === 'number' || typeof spec?.maximum === 'number') {
        const min = spec.minimum ?? '-∞';
        const max = spec.maximum ?? '∞';
        rules.push({
          field,
          rule: `range:${min}..${max}`,
          message: `${field} must be between ${min} and ${max}`,
        });
      }
      if (typeof spec?.minLength === 'number' || typeof spec?.maxLength === 'number') {
        rules.push({
          field,
          rule: `length:${spec.minLength ?? 0}..${spec.maxLength ?? '∞'}`,
          message: `${field} length is out of range`,
        });
      }
    }

    return rules;
  }

  private testCases(
    method: string,
    path: string,
    schema: any,
    isList: boolean,
    failureTypes: string[],
  ): TestCase[] {
    const cases: TestCase[] = [];
    const hasPathParam = /\{[^}]+\}/.test(path);
    const sample = this.generator.generate(schema, { seed: 21 });

    if (WRITE_METHODS.has(method)) {
      cases.push({
        name: 'accepts a valid body',
        method,
        path,
        body: sample,
        expectStatus: method === 'POST' ? 201 : 200,
      });

      const required: string[] = Array.isArray(schema?.required)
        ? schema.required
        : Object.keys(schema?.properties ?? {}).slice(0, 3);
      for (const field of required) {
        const body = { ...(sample as Record<string, unknown>) };
        delete body[field];
        cases.push({
          name: `rejects a body missing ${field}`,
          method,
          path,
          body,
          expectStatus: 400,
        });
      }

      const [firstField, firstSpec] = Object.entries<any>(
        schema?.properties ?? {},
      )[0] ?? [];
      if (firstField) {
        cases.push({
          name: `rejects ${firstField} of the wrong type`,
          method,
          path,
          body: {
            ...(sample as Record<string, unknown>),
            [firstField]: firstSpec?.type === 'string' ? 12345 : 'not-a-number',
          },
          expectStatus: 400,
        });
      }
    } else {
      cases.push({
        name: isList ? 'returns a list' : 'returns the resource',
        method,
        path,
        expectStatus: method === 'DELETE' ? 204 : 200,
      });
    }

    if (hasPathParam) {
      cases.push({
        name: 'returns 404 for an unknown id',
        method,
        path: path.replace(/\{[^}]+\}/, 'does-not-exist'),
        expectStatus: 404,
        note: 'Requires the endpoint to be stateful; static mocks always match.',
      });
    }

    if (isList) {
      cases.push({
        name: 'paginates',
        method,
        path: `${path}?_page=2&_limit=5`,
        expectStatus: 200,
        note: 'Stateful endpoints honour _page/_limit/_sort/q.',
      });
    }

    for (const type of failureTypes) {
      cases.push({
        name: `client survives an injected ${type} failure`,
        method,
        path,
        expectStatus: type === 'error' ? 500 : type === 'db_down' ? 503 : 504,
        note: `This endpoint injects ${type} failures; the client should retry or degrade.`,
      });
    }

    return cases;
  }
}
