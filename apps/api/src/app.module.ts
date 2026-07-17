import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health.controller';

/**
 * Root module. Domain modules (auth, mock, parser, stateful, failure, ai,
 * webhook, ...) get wired in here as each phase lands. Phase 0 keeps this
 * minimal so the API boots with no external dependencies.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
  ],
  controllers: [HealthController],
})
export class AppModule {}
