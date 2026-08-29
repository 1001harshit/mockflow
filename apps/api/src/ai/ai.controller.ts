import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
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
import { AiJobsService } from './ai-jobs.service';
import { AiService } from './ai.service';
import { OpenAiClient } from './openai.client';
import { GenerateDataDto } from './dto/generate-data.dto';

/**
 * AI generation (Phase 6), scoped to a project so it reuses ProjectAccessGuard.
 * Jobs themselves are workspace-scoped, which is where quota will eventually sit.
 */
@Controller('api/projects/:id/ai')
@UseGuards(JwtAuthGuard, ProjectAccessGuard)
export class AiController {
  constructor(
    private readonly ai: AiService,
    private readonly jobs: AiJobsService,
    private readonly openai: OpenAiClient,
  ) {}

  /**
   * Whether live generation is available. Without a key MockFlow still
   * generates data locally, so this reports capability rather than health.
   */
  @Get('status')
  status() {
    return {
      provider: 'openai',
      configured: this.openai.configured,
      fallback: 'local',
    };
  }

  @Get('jobs')
  jobs_(@CurrentProject() project: ProjectRef, @Query('limit') limit?: string) {
    return this.jobs.list(project.workspaceId, limit ? Number(limit) : 20);
  }

  /** Fill an endpoint's response with believable data. */
  @Post('endpoints/:endpointId/generate')
  @HttpCode(HttpStatus.OK)
  generate(
    @CurrentProject() project: ProjectRef,
    @Param('endpointId') endpointId: string,
    @Body() dto: GenerateDataDto,
  ) {
    return this.ai.generateData(
      project.workspaceId,
      project.id,
      endpointId,
      dto,
    );
  }
}
