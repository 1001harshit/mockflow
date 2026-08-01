import { Module } from '@nestjs/common';
import { OpenApiParser } from './openapi.parser';

@Module({
  providers: [OpenApiParser],
  exports: [OpenApiParser],
})
export class ParserModule {}
