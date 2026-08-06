import { Module } from '@nestjs/common';
import { MockController } from './mock.controller';
import { MockService } from './mock.service';
import { ResponseGenerator } from './response-generator.service';

@Module({
  controllers: [MockController],
  providers: [MockService, ResponseGenerator],
})
export class MockModule {}
