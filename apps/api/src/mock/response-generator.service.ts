import { Injectable } from '@nestjs/common';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Synthesizes a response body from a JSON schema when no concrete example was
 * provided by the spec. Deterministic (no randomness) for stable mocks.
 */
@Injectable()
export class ResponseGenerator {
  generate(schema: any): unknown {
    if (schema == null || typeof schema !== 'object') return {};
    if (schema.example !== undefined) return schema.example;
    if (Array.isArray(schema.enum) && schema.enum.length) return schema.enum[0];

    switch (schema.type) {
      case 'object': {
        const out: Record<string, unknown> = {};
        for (const [key, value] of Object.entries<any>(schema.properties ?? {})) {
          out[key] = this.generate(value);
        }
        return out;
      }
      case 'array':
        return [this.generate(schema.items ?? {})];
      case 'integer':
      case 'number':
        return 0;
      case 'boolean':
        return true;
      case 'string':
        return this.stringForFormat(schema.format);
      default:
        return null;
    }
  }

  private stringForFormat(format?: string): string {
    switch (format) {
      case 'email':
        return 'user@example.com';
      case 'uuid':
        return '00000000-0000-0000-0000-000000000000';
      case 'date-time':
        return '2024-01-01T00:00:00.000Z';
      case 'date':
        return '2024-01-01';
      default:
        return 'string';
    }
  }
}
