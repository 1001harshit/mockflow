import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { DatabaseClient, databaseKind } from './client';

/**
 * Thin wrapper around PrismaClient that ties the DB connection lifecycle to
 * the Nest application lifecycle.
 */
@Injectable()
export class PrismaService
  extends DatabaseClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log(`Connected to database (${databaseKind})`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
