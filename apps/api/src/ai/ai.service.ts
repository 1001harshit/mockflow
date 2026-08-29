import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiJobsService } from './ai-jobs.service';
import { OpenAiClient } from './openai.client';
import { RealisticGenerator } from './realistic-generator.service';
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
