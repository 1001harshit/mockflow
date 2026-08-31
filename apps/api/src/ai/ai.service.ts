import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiJobsService } from './ai-jobs.service';
import { OpenAiClient } from './openai.client';
import { RealisticGenerator } from './realistic-generator.service';
import { SuggestionsService, Suggestions, TestCase } from './suggestions.service';
import { GenerateDataDto } from './dto/generate-data.dto';

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface GeneratedData {
  source: 'openai' | 'local';
  data: unknown;
  saved: boolean;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly openai: OpenAiClient,
    private readonly local: RealisticGenerator,
    private readonly suggestions: SuggestionsService,
    private readonly jobs: AiJobsService,
  ) {}

  /**
   * Fills an endpoint's response with believable data.
   *
   * Prefers the model when one is configured, but falls back to local
   * generation if the call fails — a mock server that stops working because
   * someone else's API is down would be a poor mock server.
   */
  async generateData(
    workspaceId: string,
    projectId: string,
    endpointId: string,
    dto: GenerateDataDto,
  ): Promise<GeneratedData> {
    const endpoint = await this.prisma.endpoint.findFirst({
      where: { id: endpointId, projectId },
    });
    if (!endpoint) throw new NotFoundException('Endpoint not found');

    const schema = endpoint.responseSchema ?? {};
    const useModel = this.openai.configured && !dto.local;

    let data: unknown;
    let source: GeneratedData['source'] = 'local';

    if (useModel) {
      try {
        const result = await this.jobs.track(
          workspaceId,
          'generate-data',
          { endpointId, path: endpoint.path, count: dto.count, hint: dto.hint },
          () =>
            this.openai.json<{ data: unknown }>(
              this.dataPrompt(endpoint.method, endpoint.path, schema, dto),
              { bulk: true },
            ),
        );
        data = (result.output as any)?.data ?? result.output;
        source = 'openai';
      } catch (err) {
        this.logger.warn(
          `Falling back to local generation: ${err instanceof Error ? err.message : err}`,
        );
      }
    }

    if (data === undefined) {
      data = this.local.generate(schema, { count: dto.count, seed: dto.seed });
    }

    let saved = false;
    if (dto.save) {
      await this.saveResponse(endpointId, data);
      saved = true;
    }

    return { source, data, saved };
  }

  /**
   * Suggests response examples, validation rules and a starting test suite for
   * an endpoint. The schema-derived set is always returned; a configured model
   * only adds edge cases on top, so this never returns less than it would have.
   */
  async suggest(
    workspaceId: string,
    projectId: string,
    endpointId: string,
    options: { local?: boolean } = {},
  ): Promise<Suggestions & { source: 'openai' | 'local' }> {
    const endpoint = await this.prisma.endpoint.findFirst({
      where: { id: endpointId, projectId },
    });
    if (!endpoint) throw new NotFoundException('Endpoint not found');

    const failureTypes = Array.isArray(endpoint.failureRules)
      ? (endpoint.failureRules as any[])
          .filter((r) => r?.enabled !== false && r?.type !== 'slow')
          .map((r) => String(r?.type))
      : [];

    const derived = this.suggestions.build(
      endpoint.method,
      endpoint.path,
      endpoint.responseSchema,
      endpoint.requestSchema,
      failureTypes,
    );

    if (!this.openai.configured || options.local) {
      return { ...derived, source: 'local' };
    }

    try {
      const result = await this.jobs.track(
        workspaceId,
        'generate-tests',
        { endpointId, path: endpoint.path },
        () =>
          this.openai.json<{ testCases: TestCase[] }>(
            this.testPrompt(endpoint.method, endpoint.path, endpoint.responseSchema, derived),
          ),
      );
      const extra = Array.isArray(result.output?.testCases)
        ? result.output.testCases
        : [];
      return {
        ...derived,
        testCases: [...derived.testCases, ...extra],
        source: 'openai',
      };
    } catch (err) {
      this.logger.warn(
        `Suggestion enrichment failed, returning derived set: ${
          err instanceof Error ? err.message : err
        }`,
      );
      return { ...derived, source: 'local' };
    }
  }

  private testPrompt(
    method: string,
    path: string,
    schema: unknown,
    derived: Suggestions,
  ): string {
    return [
      `Suggest additional edge-case tests for ${method} ${path}.`,
      'Schema:',
      JSON.stringify(schema).slice(0, 3_000),
      'Already covered, do not repeat:',
      derived.testCases.map((t) => `- ${t.name}`).join('\n'),
      'Return {"testCases": [{"name", "method", "path", "body", "expectStatus", "note"}]}.',
      'Focus on boundaries, encoding, concurrency and auth — at most 6 cases.',
    ].join('\n');
  }

  /** Replaces the endpoint's default response body with the generated data. */
  private async saveResponse(endpointId: string, data: unknown): Promise<void> {
    const current = await this.prisma.response.findFirst({
      where: { endpointId, isDefault: true },
    });
    if (current) {
      await this.prisma.response.update({
        where: { id: current.id },
        data: { body: data as any },
      });
      return;
    }
    await this.prisma.response.create({
      data: {
        endpointId,
        name: 'default',
        isDefault: true,
        statusCode: 200,
        body: data as any,
      },
    });
  }

  private dataPrompt(
    method: string,
    path: string,
    schema: unknown,
    dto: GenerateDataDto,
  ): string {
    return [
      `Generate realistic mock data for the API response of ${method} ${path}.`,
      dto.hint ? `Context: ${dto.hint}` : '',
      `Return {"data": <body>} where <body> matches this JSON Schema exactly:`,
      JSON.stringify(schema).slice(0, 4_000),
      dto.count
        ? `If the body is a list, return exactly ${dto.count} items.`
        : 'If the body is a list, return 5 items.',
      'Values must be internally consistent: an email should match its name, a',
      'brand should belong to its category, totals should match their line items.',
      'Use plausible real-world values, never placeholders like "string" or "foo".',
    ]
      .filter(Boolean)
      .join('\n');
  }
}
