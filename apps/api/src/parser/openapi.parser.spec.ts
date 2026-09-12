import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { OpenApiParser } from './openapi.parser';

const parser = new OpenApiParser();

const openapi = (paths: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
  openapi: '3.0.0',
  info: { title: 'Test API', version: '1.0.0' },
  paths,
  ...extra,
});

describe('OpenApiParser.supports', () => {
  it('accepts OpenAPI 3 and Swagger 2 documents', () => {
    expect(parser.supports({ openapi: '3.0.0' })).toBe(true);
    expect(parser.supports({ swagger: '2.0' })).toBe(true);
  });

  it('rejects anything else', () => {
    expect(parser.supports({ paths: {} })).toBe(false);
    expect(parser.supports(null)).toBe(false);
  });
});

describe('OpenApiParser.parse', () => {
  it('rejects a document with no paths', () => {
    expect(() => parser.parse({ openapi: '3.0.0' })).toThrow(/missing "paths"/);
  });

  it('rejects a document whose paths yield no operations', () => {
    expect(() => parser.parse(openapi({ '/x': { summary: 'not a method' } }))).toThrow(
      /no usable operations/,
    );
  });

  it('reads the title and one endpoint per method', () => {
    const result = parser.parse(
      openapi({
        '/users': {
          get: { responses: { '200': {} } },
          post: { responses: { '201': {} } },
        },
      }),
    );
    expect(result.title).toBe('Test API');
    expect(result.endpoints.map((e) => e.method).sort()).toEqual(['GET', 'POST']);
  });

  it('ignores keys that are not HTTP methods', () => {
    const result = parser.parse(
      openapi({
        '/users': {
          get: { responses: { '200': {} } },
          parameters: [{ name: 'limit', in: 'query' }],
        },
      }),
    );
    expect(result.endpoints).toHaveLength(1);
  });

  it('prefers a 2xx response over other statuses', () => {
    const [endpoint] = parser.parse(
      openapi({
        '/users': {
          get: { responses: { '404': {}, '201': {}, '500': {} } },
        },
      }),
    ).endpoints;
    expect(endpoint.response.statusCode).toBe(201);
  });

  it('falls back to the only response when none is 2xx', () => {
    const [endpoint] = parser.parse(
      openapi({ '/users': { get: { responses: { '418': {} } } } }),
    ).endpoints;
    expect(endpoint.response.statusCode).toBe(418);
  });

  it('takes the example from OpenAPI 3 content', () => {
    const [endpoint] = parser.parse(
      openapi({
        '/users': {
          get: {
            responses: {
              '200': {
                content: { 'application/json': { example: [{ id: 1 }] } },
              },
            },
          },
        },
      }),
    ).endpoints;
    expect(endpoint.response.body).toEqual([{ id: 1 }]);
  });

  it('takes the first named example when there is no single example', () => {
    const [endpoint] = parser.parse(
      openapi({
        '/users': {
          get: {
            responses: {
              '200': {
                content: {
                  'application/json': {
                    examples: { first: { value: { id: 7 } } },
                  },
                },
              },
            },
          },
        },
      }),
    ).endpoints;
    expect(endpoint.response.body).toEqual({ id: 7 });
  });

  it('reads a Swagger 2 schema and example', () => {
    const [endpoint] = parser.parse({
      swagger: '2.0',
      info: { title: 'Legacy' },
      paths: {
        '/users': {
          get: {
            responses: {
              '200': {
                schema: { type: 'object' },
                examples: { 'application/json': { id: 3 } },
              },
            },
          },
        },
      },
    }).endpoints;
    expect(endpoint.response.body).toEqual({ id: 3 });
    expect(endpoint.response.schema).toEqual({ type: 'object' });
  });

  it('resolves a $ref into components', () => {
    const [endpoint] = parser.parse(
      openapi(
        {
          '/users': {
            get: {
              responses: {
                '200': {
                  content: {
                    'application/json': {
                      schema: { $ref: '#/components/schemas/User' },
                    },
                  },
                },
              },
            },
          },
        },
        {
          components: {
            schemas: {
              User: { type: 'object', properties: { id: { type: 'string' } } },
            },
          },
        },
      ),
    ).endpoints;
    expect(endpoint.response.schema).toEqual({
      type: 'object',
      properties: { id: { type: 'string' } },
    });
  });

  it('keeps the $ref itself when it points nowhere', () => {
    const [endpoint] = parser.parse(
      openapi({
        '/users': {
          get: {
            responses: {
              '200': {
                content: {
                  'application/json': { schema: { $ref: '#/components/schemas/Gone' } },
                },
              },
            },
          },
        },
      }),
    ).endpoints;
    expect(endpoint.response.schema).toEqual({ $ref: '#/components/schemas/Gone' });
  });

  it('prefers summary over description for the endpoint label', () => {
    const [endpoint] = parser.parse(
      openapi({
        '/users': {
          get: { summary: 'List users', description: 'Longer text', responses: { '200': {} } },
        },
      }),
    ).endpoints;
    expect(endpoint.description).toBe('List users');
  });
});
