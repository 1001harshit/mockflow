import { Module } from '@nestjs/common';
import { FailureModule } from '../failure/failure.module';
import { StatefulModule } from '../stateful/stateful.module';
import { MockController } from './mock.controller';
import { MockService } from './mock.service';
import { ResponseGenerator } from './response-generator.service';

@Module({
  imports: [StatefulModule, FailureModule],
  controllers: [MockController],
  providers: [MockService, ResponseGenerator],
})
export class MockModule {}
