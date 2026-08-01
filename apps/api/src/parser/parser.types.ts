import { HttpMethod } from '@prisma/client';

/** A single response the mock engine can serve for an endpoint. */
export interface ParsedResponse {
  statusCode: number;
  /** Concrete example body, if the spec provided one. */
  body?: unknown;
  /** JSON schema to synthesize a body from when there's no example. */
  schema?: unknown;
}

/** One method+path pair distilled from an API spec. */
export interface ParsedEndpoint {
  method: HttpMethod;
  path: string; // e.g. "/users/{id}"
  description?: string;
  response: ParsedResponse;
}

export interface ParsedApi {
  title?: string;
  endpoints: ParsedEndpoint[];
}
