import { Module } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { SigningService } from './signing.service';
import { DeliveryService } from './delivery.service';

@Module({
  imports: [ProjectsModule],
  controllers: [WebhooksController],
  providers: [WebhooksService, SigningService, DeliveryService],
  exports: [WebhooksService, SigningService, DeliveryService],
})
export class WebhooksModule {}
