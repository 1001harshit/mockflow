import { join } from 'node:path';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { WorkspacesModule } from './workspaces/workspaces.module';
import { ApiKeysModule } from './api-keys/api-keys.module';
import { ProjectsModule } from './projects/projects.module';
import { MockModule } from './mock/mock.module';
import { AiModule } from './ai/ai.module';
import { WebhooksModule } from './webhooks/webhooks.module';

/**
 * Root module. Domain modules (auth, mock, parser, stateful, failure, ai,
 * webhook, ...) get wired in here as each phase lands.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // The .env lives at the repo root, but the working directory is apps/api
      // when this is started through its own package script. Look in both, so
      // `pnpm dev` works from either place without exporting anything by hand.
      envFilePath: [
        join(process.cwd(), '.env'),
        join(process.cwd(), '..', '..', '.env'),
      ],
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    WorkspacesModule,
    ApiKeysModule,
    ProjectsModule,
    MockModule,
    AiModule,
    WebhooksModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
