import { Module } from '@nestjs/common';
import { StatefulService } from './stateful.service';

@Module({
  providers: [StatefulService],
  exports: [StatefulService],
})
export class StatefulModule {}
