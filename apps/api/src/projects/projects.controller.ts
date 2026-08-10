import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ProjectAccessGuard } from './guards/project-access.guard';
import { ProjectsService } from './projects.service';
import { UpdateEndpointDto } from './dto/update-endpoint.dto';

/* eslint-disable @typescript-eslint/no-explicit-any */

@Controller('api/projects/:id')
@UseGuards(JwtAuthGuard, ProjectAccessGuard)
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  /** Upload an OpenAPI/Swagger document (raw JSON body). */
  @Post('import')
  @HttpCode(HttpStatus.OK)
  import(@Param('id') projectId: string, @Body() spec: any) {
    return this.projects.import(projectId, spec);
  }

  @Get('endpoints')
  endpoints(@Param('id') projectId: string) {
    return this.projects.listEndpoints(projectId);
  }

  @Patch('endpoints/:endpointId')
  updateEndpoint(
    @Param('id') projectId: string,
    @Param('endpointId') endpointId: string,
    @Body() dto: UpdateEndpointDto,
  ) {
    return this.projects.updateEndpoint(projectId, endpointId, dto);
  }

  @Get('logs')
  logs(@Param('id') projectId: string, @Query('limit') limit?: string) {
    return this.projects.listLogs(projectId, limit ? Number(limit) : 50);
  }

  @Get('stats')
  stats(@Param('id') projectId: string) {
    return this.projects.stats(projectId);
  }
}
