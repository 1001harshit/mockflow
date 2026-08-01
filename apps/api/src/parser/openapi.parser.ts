import { BadRequestException, Injectable } from '@nestjs/common';
import { HttpMethod } from '@prisma/client';
import { ParsedApi, ParsedEndpoint, ParsedResponse } from './parser.types';

/* eslint-disable @typescript-eslint/no-explicit-any */

const METHODS: Record<string, HttpMethod> = {
  get: HttpMethod.GET,
  post: HttpMethod.POST,
  put: HttpMethod.PUT,
  patch: HttpMethod.PATCH,
  delete: HttpMethod.DELETE,
  head: HttpMethod.HEAD,
  options: HttpMethod.OPTIONS,
};

/**
 * Converts an OpenAPI 3 / Swagger 2 document into MockFlow's internal endpoint
 * model. Prefers concrete examples; falls back to the response schema.
 */
@Injectable()
export class OpenApiParser {
  supports(doc: any): boolean {
    return Boolean(doc && (doc.openapi || doc.swagger));
  }

  parse(doc: any): ParsedApi {
    if (!doc || typeof doc !== 'object' || typeof doc.paths !== 'object') {
      throw new BadRequestException(
        'Not a valid OpenAPI/Swagger document (missing "paths")',
      );
    }

    const endpoints: ParsedEndpoint[] = [];
    for (const [path, item] of Object.entries<any>(doc.paths)) {
      if (!item || typeof item !== 'object') continue;
      for (const [rawMethod, operation] of Object.entries<any>(item)) {
        const method = METHODS[rawMethod.toLowerCase()];
        if (!method || !operation || typeof operation !== 'object') continue;
        endpoints.push({
          method,
          path,
          description: operation.summary ?? operation.description,
          response: this.extractResponse(operation, doc),
        });
      }
    }

    if (endpoints.length === 0) {
      throw new BadRequestException('Spec contained no usable operations');
    }
    return { title: doc.info?.title, endpoints };
  }

  private extractResponse(operation: any, doc: any): ParsedResponse {
    const responses = operation.responses ?? {};
    const statusKey = this.pickStatus(responses);
    const response = responses[statusKey] ?? responses.default ?? {};

    // OpenAPI 3 nests bodies under content; Swagger 2 puts schema directly.
    const json = response.content?.['application/json'];
    const schema = json?.schema ?? response.schema;
    const example =
      json?.example ??
      (json?.examples && (Object.values<any>(json.examples)[0] as any)?.value) ??
      response.examples?.['application/json'] ??
      schema?.example;

    return {
      statusCode: Number(statusKey) || 200,
      body: example,
      schema: this.resolveRef(schema, doc),
    };
  }

  private pickStatus(responses: Record<string, unknown>): string {
    const keys = Object.keys(responses);
    return keys.find((k) => k.startsWith('2')) ?? keys[0] ?? '200';
  }

  /** Shallow $ref resolution (one hop) into the document. */
  private resolveRef(schema: any, doc: any): any {
    if (schema && typeof schema.$ref === 'string') {
      const segments = schema.$ref.replace(/^#\//, '').split('/');
      let node: any = doc;
      for (const segment of segments) node = node?.[segment];
      return node ?? schema;
    }
    return schema;
  }
}
