/**
 * Integration tests for Auth endpoints + RLS tenant isolation.
 *
 * Prerequisites (handled automatically by the CI workflow):
 *   - PostgreSQL running with DATABASE_URL pointing to the test DB
 *   - Migrations applied: `prisma migrate deploy`
 *   - Env vars: JWT_SECRET, JWT_REFRESH_SECRET (any value for tests)
 *
 * To run locally:
 *   docker compose up -d
 *   cp .env.example .env   # ensure DATABASE_URL and JWT secrets are set
 *   npm run migrate:deploy -w apps/api
 *   npm run test:e2e -w apps/api
 */

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const tenantA = {
  tenantName: 'Alpha Spares',
  subdomain: 'test-alpha',
  businessType: 'SPARE_PARTS',
  ownerName: 'Alice',
  email: 'alice@test-alpha.com',
  password: 'AlicePass123!',
};

const tenantB = {
  tenantName: 'Beta Resto',
  subdomain: 'test-beta',
  businessType: 'RESTAURANT',
  ownerName: 'Bob',
  email: 'bob@test-beta.com',
  password: 'BobPass456!',
};

// ─── Suite ───────────────────────────────────────────────────────────────────

describe('Auth + Tenant Isolation (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  // Tokens and IDs captured across tests
  let tokenA: string;
  let tokenB: string;
  let tenantAId: string;
  let tenantBId: string;
  let userBId: string;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
    );
    await app.init();
    prisma = module.get(PrismaService);

    // Clean up any leftover test data from a previous failed run
    await cleanTestTenants(prisma);
  });

  afterAll(async () => {
    await cleanTestTenants(prisma);
    await app.close();
  });

  // ─── Registration ──────────────────────────────────────────────────────────

  describe('POST /auth/register-tenant', () => {
    it('creates tenant A and returns tokens', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register-tenant')
        .send(tenantA)
        .expect(201);

      expect(res.body.accessToken).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();
      expect(res.body.tenant.subdomain).toBe('test-alpha');
      expect(res.body.user.passwordHash).toBeUndefined(); // never exposed

      tokenA = res.body.accessToken;
      tenantAId = res.body.tenant.id;
    });

    it('creates tenant B and returns tokens', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register-tenant')
        .send(tenantB)
        .expect(201);

      tokenB = res.body.accessToken;
      tenantBId = res.body.tenant.id;
      userBId = res.body.user.id;
    });

    it('rejects duplicate subdomain with 409', async () => {
      await request(app.getHttpServer())
        .post('/auth/register-tenant')
        .send(tenantA)
        .expect(409);
    });

    it('rejects invalid payload with 400', async () => {
      await request(app.getHttpServer())
        .post('/auth/register-tenant')
        .send({ subdomain: 'INVALID SPACES', email: 'not-an-email' })
        .expect(400);
    });
  });

  // ─── Login ─────────────────────────────────────────────────────────────────

  describe('POST /auth/login', () => {
    it('returns tokens for valid credentials', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ subdomain: 'test-alpha', email: tenantA.email, password: tenantA.password })
        .expect(200);

      expect(res.body.accessToken).toBeDefined();
      expect(res.body.user.email).toBe(tenantA.email);
    });

    it('rejects wrong password with 401', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ subdomain: 'test-alpha', email: tenantA.email, password: 'wrong' })
        .expect(401);
    });

    it('rejects unknown subdomain with 401', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ subdomain: 'no-such-tenant', email: tenantA.email, password: tenantA.password })
        .expect(401);
    });
  });

  // ─── Token refresh ─────────────────────────────────────────────────────────

  describe('POST /auth/refresh', () => {
    it('issues a new access token from a valid refresh token', async () => {
      // Get a fresh refresh token
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ subdomain: 'test-alpha', email: tenantA.email, password: tenantA.password })
        .expect(200);

      const res = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: loginRes.body.refreshToken })
        .expect(200);

      expect(res.body.accessToken).toBeDefined();
    });

    it('rejects an access token used as a refresh token', async () => {
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: tokenA }) // access token, wrong type claim
        .expect(401);
    });
  });

  // ─── GET /auth/me ──────────────────────────────────────────────────────────

  describe('GET /auth/me', () => {
    it("returns the authenticated user's profile", async () => {
      const res = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(res.body.email).toBe(tenantA.email);
      expect(res.body.tenantId).toBe(tenantAId);
      expect(res.body.passwordHash).toBeUndefined();
    });

    it('rejects unauthenticated requests with 401', async () => {
      await request(app.getHttpServer()).get('/auth/me').expect(401);
    });
  });

  // ─── RLS Tenant Isolation ──────────────────────────────────────────────────
  //
  // These tests are the core of the isolation guarantee.  They prove that even
  // when a caller has a valid access token and tries to read another tenant's
  // data (either via the API or directly via prisma.withTenant), PostgreSQL RLS
  // blocks it at the database layer — no amount of crafted application logic
  // can bypass it.

  describe('RLS tenant isolation', () => {
    it("tenant A's JWT cannot read tenant B's user via GET /auth/me", async () => {
      // tokenA is signed for tenantAId. The JwtStrategy puts tenantAId in
      // req.user.  authService.getMe() calls withTenant(tenantAId, ...) which
      // sets app.current_tenant = tenantAId.  Even though we pass tokenA, the
      // lookup for userBId returns null because tenant_id ≠ tenantAId.
      //
      // We can't directly hit /auth/me with tenant B's userId via the API
      // (it always uses the token's userId), so we prove isolation at the
      // Prisma layer instead — the equivalent of a crafted query.
      const leakedUser = await prisma.withTenant(tenantAId, (tx) =>
        tx.user.findUnique({ where: { id: userBId } }),
      );

      expect(leakedUser).toBeNull(); // RLS blocked it
    });

    it('tenant B users are invisible when tenant A context is active (findMany)', async () => {
      const users = await prisma.withTenant(tenantAId, (tx) => tx.user.findMany());

      const tenantBUserFound = users.some((u) => u.tenantId === tenantBId);
      expect(tenantBUserFound).toBe(false);
      // Tenant A's own user IS visible
      expect(users.some((u) => u.tenantId === tenantAId)).toBe(true);
    });

    it('tenant A cannot insert a row on behalf of tenant B (RLS WITH CHECK)', async () => {
      // Attempt to create a user with tenantBId while the session has tenantAId.
      // PostgreSQL's WITH CHECK policy on the INSERT should reject this.
      await expect(
        prisma.withTenant(tenantAId, (tx) =>
          tx.user.create({
            data: {
              tenantId: tenantBId, // ← wrong tenant
              name: 'Attacker',
              email: 'attacker@evil.com',
              passwordHash: 'irrelevant',
              role: 'CASHIER',
            },
          }),
        ),
      ).rejects.toThrow(); // PrismaClientKnownRequestError or similar
    });

    it('each tenant sees only their own outlets', async () => {
      const outletsA = await prisma.withTenant(tenantAId, (tx) =>
        tx.outlet.findMany(),
      );
      const outletsB = await prisma.withTenant(tenantBId, (tx) =>
        tx.outlet.findMany(),
      );

      expect(outletsA.every((o) => o.tenantId === tenantAId)).toBe(true);
      expect(outletsB.every((o) => o.tenantId === tenantBId)).toBe(true);
      // No cross-contamination
      expect(outletsA.some((o) => o.tenantId === tenantBId)).toBe(false);
      expect(outletsB.some((o) => o.tenantId === tenantAId)).toBe(false);
    });
  });
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Delete test tenants + cascade (outlets, users, devices).
 *
 * CASCADE deletes on RLS-enabled tables require the tenant context to be set
 * for each tenant before deleting, because RLS FORCE applies to cascade ops.
 * We delete each tenant individually inside its own withTenant transaction.
 */
async function cleanTestTenants(prisma: PrismaService): Promise<void> {
  const testTenants = await prisma.tenant.findMany({
    where: { subdomain: { startsWith: 'test-' } },
    select: { id: true },
  });

  for (const { id } of testTenants) {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_tenant', ${id}, true)`;
      await tx.tenant.delete({ where: { id } });
    });
  }
}
