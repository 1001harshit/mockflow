import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Provider, SigningService } from './signing.service';
import { CreateWebhookDto } from './dto/create-webhook.dto';

@Injectable()
export class WebhooksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly signing: SigningService,
  ) {}

  /**
   * Registers a webhook target. The secret is returned in full here and never
   * again — the same contract the real providers use.
   */
  async create(projectId: string, dto: CreateWebhookDto) {
    const secret = dto.secret ?? this.signing.generateSecret(dto.provider);
    const webhook = await this.prisma.webhook.create({
      data: {
        projectId,
        name: dto.name,
        provider: dto.provider,
        targetUrl: dto.targetUrl,
        secret,
      },
    });
    return {
      id: webhook.id,
      name: webhook.name,
      provider: webhook.provider as Provider,
      targetUrl: webhook.targetUrl,
      secret,
      signatureHeader: this.signing.signatureHeaderFor(
        webhook.provider as Provider,
      ),
      createdAt: webhook.createdAt,
    };
  }

  list(projectId: string) {
    return this.prisma.webhook.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        provider: true,
        targetUrl: true,
        createdAt: true,
        _count: { select: { deliveries: true } },
      },
    });
  }

  async remove(projectId: string, webhookId: string) {
    const webhook = await this.prisma.webhook.findFirst({
      where: { id: webhookId, projectId },
    });
    if (!webhook) throw new NotFoundException('Webhook not found');
    await this.prisma.webhook.delete({ where: { id: webhookId } });
    return { deleted: true };
  }

  /** Delivery history, newest first, across one webhook. */
  async deliveries(projectId: string, webhookId: string, limit = 50) {
    const webhook = await this.prisma.webhook.findFirst({
      where: { id: webhookId, projectId },
      select: { id: true },
    });
    if (!webhook) throw new NotFoundException('Webhook not found');

    return this.prisma.webhookDelivery.findMany({
      where: { webhookId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 200),
      select: {
        id: true,
        event: true,
        attempt: true,
        success: true,
        statusCode: true,
        responseBody: true,
        createdAt: true,
      },
    });
  }
}
