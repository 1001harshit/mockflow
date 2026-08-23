import { Module } from '@nestjs/common';
import { FailureModule } from '../failure/failure.module';
import { ParserModule } from '../parser/parser.module';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { ProjectAccessGuard } from './guards/project-access.guard';

@Module({
  imports: [ParserModule, FailureModule],
  controllers: [ProjectsController],
  providers: [ProjectsService, ProjectAccessGuard],
  exports: [ProjectsService, ProjectAccessGuard],
})
export class ProjectsModule {}
