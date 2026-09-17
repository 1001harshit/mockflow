import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Thin wrapper around PrismaClient that ties the DB connection lifecycle to
 * the Nest application lifecycle.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit(): Promise<void> {
    await this.$connect();

    // SQLite defaults to a rollback journal, which serialises readers behind
    // the writer. The mock plane logs a row per request, so without WAL the
    // logging would throttle the thing it is only meant to observe.
    // $queryRaw, not $executeRaw: some PRAGMAs answer with a row, and SQLite
    // rejects a statement that returns results through the execute path.
    await this.$queryRawUnsafe('PRAGMA journal_mode = WAL');
    await this.$queryRawUnsafe('PRAGMA synchronous = NORMAL');
    // Rather than fail instantly when a write is in flight, wait briefly.
    await this.$queryRawUnsafe('PRAGMA busy_timeout = 5000');

    this.logger.log('Connected to database');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
