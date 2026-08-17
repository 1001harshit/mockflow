import { All, Controller, Req, Res } from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';
import { HttpMethod } from '@prisma/client';
import { MockService } from './mock.service';

/**
 * The mock plane: any method under /mock/:projectId/* is matched against the
 * project's imported endpoints and served. No auth — mocks are public URLs.
 */
@Controller('mock')
export class MockController {
  constructor(private readonly mock: MockService) {}

  @All(':projectId/*')
  async serve(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<unknown> {
    const params = req.params as Record<string, string>;
    const result = await this.mock.handle(
      params.projectId,
      req.method as HttpMethod,
      `/${params['*'] ?? ''}`,
      { ip: req.ip, userAgent: req.headers['user-agent'] },
      req.body,
      req.query as Record<string, string | string[] | undefined>,
    );
    reply.status(result.statusCode);
    return result.body;
  }
}
