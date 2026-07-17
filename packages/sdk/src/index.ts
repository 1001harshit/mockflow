// @mockflow/sdk — the TypeScript client for MockFlow.
// Full implementation lands in Phase 8.

export const SDK_VERSION = '0.0.0';

export interface MockFlowClientOptions {
  baseUrl: string;
  apiKey?: string;
}

export class MockFlowClient {
  constructor(private readonly options: MockFlowClientOptions) {}

  get baseUrl(): string {
    return this.options.baseUrl;
  }
}
