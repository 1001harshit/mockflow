import { FailureType } from '../failure/failure.types';

export interface MockResult {
  statusCode: number;
  body: unknown;
  /** Set when failure simulation altered this response (Phase 5). */
  failure?: FailureType;
  /**
   * Simulated network failure: destroy the connection without replying. The
   * controller owns the socket, so it acts on this rather than sending a body.
   */
  abort?: boolean;
}

export interface MockMeta {
  ip?: string;
  userAgent?: string;
}
