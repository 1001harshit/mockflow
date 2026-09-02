import {
  Body,
  Controller,
  Delete,
  Get,
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
import { CreateWebhookDto } from './dto/create-webhook.dto';

/** Outbound webhook simulation (Phase 7), scoped to a project. */
@Controller('api/projects/:id/webhooks')
@UseGuards(JwtAuthGuard, ProjectAccessGuard)
export class WebhooksController {
  constructor(private readonly webhooks: WebhooksService) {}

  @Post()
  create(@CurrentProject() project: ProjectRef, @Body() dto: CreateWebhookDto) {
    return this.webhooks.create(project.id, dto);
  }

  @Get()
  list(@CurrentProject() project: ProjectRef) {
    return this.webhooks.list(project.id);
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
