import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ProjectAccessGuard } from '../projects/guards/project-access.guard';
import {
  CurrentProject,
  ProjectRef,
} from '../common/decorators/current-project.decorator';
import { WebhooksService } from './webhooks.service';
import { DeliveryService } from './delivery.service';
import { providerCatalog, samplePayload } from './provider-presets';
import { CreateWebhookDto } from './dto/create-webhook.dto';
import { SendWebhookDto } from './dto/send-webhook.dto';

/** Outbound webhook simulation (Phase 7), scoped to a project. */
@Controller('api/projects/:id/webhooks')
@UseGuards(JwtAuthGuard, ProjectAccessGuard)
export class WebhooksController {
  constructor(
    private readonly webhooks: WebhooksService,
    private readonly delivery: DeliveryService,
  ) {}

  @Post()
  create(@CurrentProject() project: ProjectRef, @Body() dto: CreateWebhookDto) {
    return this.webhooks.create(project.id, dto);
  }

  @Get()
  list(@CurrentProject() project: ProjectRef) {
    return this.webhooks.list(project.id);
  }

  /** Providers MockFlow can imitate, and the events each one sends. */
  @Get('providers')
  providers() {
    return providerCatalog();
  }

  /** Preview the payload a provider would send for an event. */
  @Get('providers/:provider/sample')
  sample(
    @Param('provider') provider: string,
    @Query('event') event?: string,
  ) {
    const catalog = providerCatalog().find((p) => p.provider === provider);
    if (!catalog) throw new NotFoundException('Unknown provider');
    const chosen = event ?? catalog.events[0];
    return { provider, event: chosen, payload: samplePayload(catalog.provider, chosen) };
  }

  /** Fire a signed delivery, retrying until it lands or attempts run out. */
  @Post(':webhookId/send')
  @HttpCode(HttpStatus.OK)
  send(
    @CurrentProject() project: ProjectRef,
    @Param('webhookId') webhookId: string,
    @Body() dto: SendWebhookDto,
  ) {
    return this.delivery.send(project.id, webhookId, dto);
  }

  @Delete(':webhookId')
  remove(
    @CurrentProject() project: ProjectRef,
    @Param('webhookId') webhookId: string,
  ) {
    return this.webhooks.remove(project.id, webhookId);
  }

  @Get(':webhookId/deliveries')
  deliveries(
    @CurrentProject() project: ProjectRef,
    @Param('webhookId') webhookId: string,
    @Query('limit') limit?: string,
  ) {
    return this.webhooks.deliveries(
      project.id,
      webhookId,
      limit ? Number(limit) : 50,
    );
  }
}
