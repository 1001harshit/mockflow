import { Module } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module';
import { AiController } from './ai.controller';
import { AiJobsService } from './ai-jobs.service';
import { AiService } from './ai.service';
import { OpenAiClient } from './openai.client';
import { RealisticGenerator } from './realistic-generator.service';

@Module({
  imports: [ProjectsModule],
  controllers: [AiController],
  providers: [OpenAiClient, AiJobsService, AiService, RealisticGenerator],
  exports: [OpenAiClient, AiJobsService, RealisticGenerator],
})
export class AiModule {}
