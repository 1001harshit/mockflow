/** Thrown for any non-2xx response from the MockFlow API. */
export class MockFlowError extends Error {
  constructor(
    readonly status: number,
    readonly statusText: string,
    readonly body: unknown,
    readonly url: string,
  ) {
    super(`MockFlow ${status} ${statusText} for ${url}${MockFlowError.detail(body)}`);
    this.name = 'MockFlowError';
  }

  /** True for the statuses worth retrying — the caller decides whether to. */
  get retryable(): boolean {
    return this.status === 429 || this.status >= 500;
  }

  private static detail(body: unknown): string {
    if (body && typeof body === 'object' && 'message' in body) {
      const message = (body as { message: unknown }).message;
      return `: ${Array.isArray(message) ? message.join('; ') : String(message)}`;
    }
    return '';
  }
}
