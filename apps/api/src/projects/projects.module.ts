import { Module } from '@nestjs/common';
import { ParserModule } from '../parser/parser.module';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { ProjectAccessGuard } from './guards/project-access.guard';

@Module({
  imports: [ParserModule],
  controllers: [ProjectsController],
  providers: [ProjectsService, ProjectAccessGuard],
  exports: [ProjectsService, ProjectAccessGuard],
})
export class ProjectsModule {}
