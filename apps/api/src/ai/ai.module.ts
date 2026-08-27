import { Module } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module';
import { AiController } from './ai.controller';
import { AiJobsService } from './ai-jobs.service';
import { OpenAiClient } from './openai.client';

@Module({
  imports: [ProjectsModule],
  controllers: [AiController],
  providers: [OpenAiClient, AiJobsService],
  exports: [OpenAiClient, AiJobsService],
})
export class AiModule {}
