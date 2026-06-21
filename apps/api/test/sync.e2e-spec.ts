/**
 * Sync e2e test — offline billing simulation.
 *
 * HOW TO SIMULATE OFFLINE:
 *   The Flutter app generates invoices locally (SQLite + outbox) without any
 *   network calls. We replicate that here by building the exact same payloads
 *   in memory and calling POST /sync/push directly — just as the app would
 *   once connectivity is restored.
 *
 * TO RUN:
 *   npm run test:e2e -- --testPathPattern=sync
 */

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { v4 as uuid } from 'uuid';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function registerTenant(app: INestApplication) {
  const subdomain = `sync-test-${Date.now()}`;
  const res = await request(app.getHttpServer())
    .post('/auth/register-tenant')
    .send({
      tenantName: 'Sync Test Store',
      subdomain,
      businessType: 'SUPERMARKET',
      ownerName: 'Owner',
      email: `owner@${subdomain}.test`,
      phone: '0771234567',
      password: 'Password1!',
    })
    .expect(201);
  return { token: res.body.accessToken as string, tenantId: res.body.tenant.id as string };
}

function makeOfflineInvoice(outletId: string) {
  const id = uuid(); // client-generated UUID (same as Flutter app)
  return {
    type: 'invoice',
    id,
    data: {
      id,
      outletId,
      subtotal: 150.0,
      discount: 0,
      tax: 0,
      total: 150.0,
      createdAt: new Date().toISOString(),
      items: [
        {
          productId: uuid(), // offline product id (may not exist server-side yet)
          nameSnapshot: 'Test Product',
          qty: 3,
          unitPrice: 50.0,
          discount: 0,
          tax: 0,
          lineTotal: 150.0,
        },
      ],
      payments: [{ method: 'CASH', amount: 150.0 }],
    },
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST /sync/push  (offline billing simulation)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  let tenantId: string;
  let outletId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();

    prisma = app.get(PrismaService);
    ({ token, tenantId } = await registerTenant(app));

    // Resolve the default outlet created during registration
    const outlet = await prisma.withTenant(tenantId, (tx) =>
      tx.outlet.findFirst({ where: { isDefault: true } }),
    );
    outletId = outlet!.id;

    // Seed a product so stock movements resolve cleanly
    await prisma.withTenant(tenantId, (tx) =>
      tx.product.create({
        data: {
          tenantId,
          name: 'Test Product',
          price: 50,
          taxRate: 0,
          trackStock: true,
        },
      }),
    );
  });

  afterAll(async () => {
    await prisma.withTenant(tenantId, (tx) =>
      tx.tenant.delete({ where: { id: tenantId } }),
    );
    await app.close();
  });

  it('pushes 3 offline invoices and all appear server-side exactly once', async () => {
    // ── Step 1: simulate 3 invoices created offline ──
    const offlineInvoices = [
      makeOfflineInvoice(outletId),
      makeOfflineInvoice(outletId),
      makeOfflineInvoice(outletId),
    ];

    // ── Step 2: push ──
    const pushRes = await request(app.getHttpServer())
      .post('/sync/push')
      .set('Authorization', `Bearer ${token}`)
      .send({ items: offlineInvoices, deviceId: 'test-device' })
      .expect(201);

    expect(pushRes.body.synced).toBe(3);
    expect(pushRes.body.skipped).toBe(0);

    // ── Step 3: verify each invoice exists server-side ──
    for (const inv of offlineInvoices) {
      const serverInvoice = await prisma.withTenant(tenantId, (tx) =>
        tx.invoice.findUnique({
          where: { id: inv.id },
          include: { items: true, payments: true },
        }),
      );
      expect(serverInvoice).not.toBeNull();
      expect(serverInvoice!.items).toHaveLength(1);
      expect(serverInvoice!.payments).toHaveLength(1);
      expect(Number(serverInvoice!.total)).toBe(150);
    }
  });

  it('is idempotent — pushing the same invoices again skips all 3', async () => {
    // Re-push the same UUIDs (simulating a retry after partial failure)
    const offlineInvoices = [
      makeOfflineInvoice(outletId),
      makeOfflineInvoice(outletId),
      makeOfflineInvoice(outletId),
    ];

    // Push once
    await request(app.getHttpServer())
      .post('/sync/push')
      .set('Authorization', `Bearer ${token}`)
      .send({ items: offlineInvoices })
      .expect(201);

    // Push again with the same items
    const retryRes = await request(app.getHttpServer())
      .post('/sync/push')
      .set('Authorization', `Bearer ${token}`)
      .send({ items: offlineInvoices })
      .expect(201);

    expect(retryRes.body.synced).toBe(0);
    expect(retryRes.body.skipped).toBe(3);

    // Confirm only one copy of each exists
    for (const inv of offlineInvoices) {
      const count = await prisma.withTenant(tenantId, (tx) =>
        tx.invoice.count({ where: { id: inv.id } }),
      );
      expect(count).toBe(1);
    }
  });

  it('GET /sync/pull returns products updated after cursor', async () => {
    const since = new Date(0).toISOString();
    const res = await request(app.getHttpServer())
      .get(`/sync/pull?since=${encodeURIComponent(since)}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.products).toBeInstanceOf(Array);
    expect(res.body.products.length).toBeGreaterThan(0);
    expect(res.body.cursor).toBeDefined();
    // Each product has the fields the Flutter app needs
    const p = res.body.products[0];
    expect(p).toHaveProperty('id');
    expect(p).toHaveProperty('name');
    expect(p).toHaveProperty('price');
    expect(p).toHaveProperty('updatedAt');
  });
});
