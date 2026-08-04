import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ProjectAccessGuard } from './guards/project-access.guard';
import { ProjectsService } from './projects.service';

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
}
