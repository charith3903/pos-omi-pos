import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Database connected');
    } catch (err) {
      this.logger.error('Database connection failed — check DATABASE_URL', err);
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /**
   * Wrap a block of Prisma operations inside a transaction that sets
   * app.current_tenant for the duration of that transaction only.
   *
   * Every tenant-scoped table has FORCE ROW LEVEL SECURITY with a policy:
   *   tenant_id = current_setting('app.current_tenant', true)
   *
   * Using `set_config(..., true)` (LOCAL = true) means the setting is
   * automatically reset when the transaction ends, so it never leaks across
   * pooled connections.
   *
   * Usage:
   *   const users = await this.prisma.withTenant(tenantId, (tx) =>
   *     tx.user.findMany()
   *   );
   */
  async withTenant<T>(
    tenantId: string,
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_tenant', ${tenantId}, true)`;
      return fn(tx);
    });
  }

  /**
   * Execute a cross-tenant admin operation inside a transaction without
   * any tenant RLS filter.  Only use this for:
   *   - tenant registration (creating the first rows for a brand-new tenant)
   *   - super-admin background jobs
   *
   * Regular application code must always use withTenant().
   */
  async withoutRls<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.$transaction(async (tx) => {
      // Set an impossible tenant ID so the USING clause is always false
      // UNLESS the caller explicitly sets it to the real tenant inside fn().
      // We override to empty string; the `true` flag defaults to NULL for
      // unknown keys, but setting an explicit empty string means
      // `tenant_id = ''` which no row ever matches.
      // The registration flow sets the real tenantId after creating the tenant.
      await tx.$executeRaw`SELECT set_config('app.current_tenant', '', true)`;
      return fn(tx);
    });
  }
}
