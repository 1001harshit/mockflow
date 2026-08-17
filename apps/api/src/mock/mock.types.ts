export interface MockResult {
  statusCode: number;
  body: unknown;
}

export interface MockMeta {
  ip?: string;
  userAgent?: string;
}
