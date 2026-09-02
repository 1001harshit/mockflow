import { Module } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { SigningService } from './signing.service';

@Module({
  imports: [ProjectsModule],
  controllers: [WebhooksController],
  providers: [WebhooksService, SigningService],
  exports: [WebhooksService, SigningService],
})
export class WebhooksModule {}
