import { Module } from '@nestjs/common';
import { StatefulModule } from '../stateful/stateful.module';
import { MockController } from './mock.controller';
import { MockService } from './mock.service';
import { ResponseGenerator } from './response-generator.service';

@Module({
  imports: [StatefulModule],
  controllers: [MockController],
  providers: [MockService, ResponseGenerator],
})
export class MockModule {}
