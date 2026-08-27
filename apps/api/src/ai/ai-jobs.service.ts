import { Injectable, Logger } from '@nestjs/common';
import { AiJob, AiJobStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Records every AI call as an `AiJob` row. Generation is slow, costs money and
 * occasionally returns nonsense, so each attempt leaves an auditable trace of
 * what was asked, what came back, and what it cost in wall time.
 */
@Injectable()
export class AiJobsService {
  private readonly logger = new Logger(AiJobsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Runs `work` inside a job record: RUNNING while in flight, then SUCCEEDED
   * with its output or FAILED with the error message. The error is re-thrown —
   * the job row is a trace, not a way to swallow failures.
   */
  async track<T>(
    workspaceId: string,
    kind: string,
    input: unknown,
    work: () => Promise<T>,
  ): Promise<{ job: AiJob; output: T }> {
    const job = await this.prisma.aiJob.create({
      data: {
        workspaceId,
        kind,
        status: AiJobStatus.RUNNING,
        input: (input ?? undefined) as any,
      },
    });

    const started = Date.now();
    try {
      const output = await work();
      const finished = await this.prisma.aiJob.update({
        where: { id: job.id },
        data: { status: AiJobStatus.SUCCEEDED, output: (output ?? undefined) as any },
      });
      this.logger.log(`${kind} succeeded in ${Date.now() - started}ms`);
      return { job: finished, output };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.prisma.aiJob.update({
        where: { id: job.id },
        data: { status: AiJobStatus.FAILED, error: message.slice(0, 500) },
      });
      this.logger.warn(`${kind} failed after ${Date.now() - started}ms: ${message}`);
      throw err;
    }
  }

  list(workspaceId: string, limit = 20) {
    return this.prisma.aiJob.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 100),
      select: {
        id: true,
        kind: true,
        status: true,
        error: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }
}
