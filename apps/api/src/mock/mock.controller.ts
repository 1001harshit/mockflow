import { All, Controller, Req, Res } from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';
import { HttpMethod } from '@prisma/client';
import { FAILURE_HEADER } from '../failure/failure.types';
import { MockService } from './mock.service';

/**
 * The mock plane: any method under /mock/:projectId/* is matched against the
 * project's imported endpoints and served. No auth — mocks are public URLs.
 *
 * The reply is handled manually (no `passthrough`) because a simulated network
 * failure has to destroy the socket instead of sending anything at all.
 */
@Controller('mock')
export class MockController {
  constructor(private readonly mock: MockService) {}

  @All(':projectId/*')
  async serve(
    @Req() req: FastifyRequest,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const params = req.params as Record<string, string>;
    const result = await this.mock.handle(
      params.projectId,
      req.method as HttpMethod,
      `/${params['*'] ?? ''}`,
      { ip: req.ip, userAgent: req.headers['user-agent'] },
      req.body,
      req.query as Record<string, string | string[] | undefined>,
    );

    if (result.abort) {
      // Take the reply off Fastify's hands, then cut the connection so the
      // client sees a reset rather than an HTTP error.
      reply.hijack();
      reply.raw.destroy();
      return;
    }

    if (result.failure) reply.header(FAILURE_HEADER, result.failure);
    await reply.status(result.statusCode).send(result.body);
  }
}
