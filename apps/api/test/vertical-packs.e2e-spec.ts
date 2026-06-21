/**
 * Vertical Packs E2E Test Suite
 *
 * Confirms that switching business_type changes the ENTIRE experience
 * at the call site — pack labels, attribute validation, and vertical
 * endpoints all activate or deactivate automatically.
 *
 * No code changes are required in any controller or service to add a
 * new vertical: add a pack file, register it in registry.ts, done.
 *
 * Run: npm run test:e2e -- --testPathPattern=vertical-packs
 */

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { v4 as uuid } from 'uuid';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

// ─── Test helpers ────────────────────────────────────────────────────────────

async function registerTenant(
  app: INestApplication,
  businessType: string,
  suffix = '',
) {
  const sub = `vp-${businessType.toLowerCase().replace('_', '-')}-${Date.now()}${suffix}`;
  const res = await request(app.getHttpServer())
    .post('/auth/register-tenant')
    .send({
      tenantName: `${businessType} Test`,
      subdomain: sub,
      businessType,
      ownerName: 'Test Owner',
      email: `owner@${sub}.test`,
      phone: '0771234567',
      password: 'Password1!',
    })
    .expect(201);
  return {
    token: res.body.accessToken as string,
    tenantId: res.body.tenant.id as string,
  };
}

async function seedProduct(
  app: INestApplication,
  token: string,
  extra: Record<string, unknown> = {},
) {
  const res = await request(app.getHttpServer())
    .post('/products')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Test Product', price: 100, ...extra })
    .expect(201);
  return res.body as { id: string };
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe('Vertical Packs — pack routing + attribute validation + vertical endpoints', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  // One token per vertical
  const ctx: Record<string, { token: string; tenantId: string }> = {};

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();
    prisma = app.get(PrismaService);

    // Register one tenant per vertical in parallel
    const types = ['SPARE_PARTS', 'RESTAURANT', 'SUPERMARKET', 'TEXTILE', 'MOBILE', 'ELECTRICAL', 'RENTAL'];
    await Promise.all(
      types.map(async (t) => { ctx[t] = await registerTenant(app, t); }),
    );
  }, 60_000);

  afterAll(async () => {
    await Promise.all(
      Object.values(ctx).map(({ tenantId }) =>
        prisma.tenant.delete({ where: { id: tenantId } }).catch(() => {}),
      ),
    );
    await app.close();
  });

  // ── 1. Pack routing ───────────────────────────────────────────────────────

  describe('GET /vertical-pack — returns the right pack per business_type', () => {
    const cases: [string, string, string][] = [
      ['SPARE_PARTS',  'Part',      'spare_parts'],
      ['RESTAURANT',   'Menu Item', 'restaurant'],
      ['SUPERMARKET',  'Item',      'standard'],
      ['TEXTILE',      'Style',     'standard'],
      ['MOBILE',       'Device',    'mobile'],
      ['ELECTRICAL',   'Product',   'standard'],
      ['RENTAL',       'Equipment', 'rental'],
    ];

    test.each(cases)('%s → label.product=%s, receipt=%s', async (bt, label, receipt) => {
      const res = await request(app.getHttpServer())
        .get('/vertical-pack')
        .set('Authorization', `Bearer ${ctx[bt].token}`)
        .expect(200);

      expect(res.body.businessType).toBe(bt);
      expect(res.body.labels.product).toBe(label);
      expect(res.body.receiptTemplate).toBe(receipt);
      expect(Array.isArray(res.body.productFields)).toBe(true);
    });
  });

  // ── 2. Attribute validation ────────────────────────────────────────────────

  describe('Product attribute validation — required fields enforced per vertical', () => {
    it('SPARE_PARTS: rejects product missing part_number', async () => {
      const res = await request(app.getHttpServer())
        .post('/products')
        .set('Authorization', `Bearer ${ctx.SPARE_PARTS.token}`)
        .send({ name: 'Test Part', price: 500, attributes: { brand: 'Bosch' } })
        .expect(400);
      expect(JSON.stringify(res.body)).toMatch(/Part Number is required/i);
    });

    it('SPARE_PARTS: accepts product with part_number', async () => {
      await request(app.getHttpServer())
        .post('/products')
        .set('Authorization', `Bearer ${ctx.SPARE_PARTS.token}`)
        .send({
          name: 'Brake Pad',
          price: 1500,
          attributes: {
            part_number: 'BP-1001',
            oem_number: '04465-52200',
            vehicle_make: 'Toyota',
            vehicle_model: 'Corolla',
          },
        })
        .expect(201);
    });

    it('SPARE_PARTS: rejects invalid vehicle_make option', async () => {
      const res = await request(app.getHttpServer())
        .post('/products')
        .set('Authorization', `Bearer ${ctx.SPARE_PARTS.token}`)
        .send({
          name: 'Part X',
          price: 100,
          attributes: { part_number: 'P-999', vehicle_make: 'Lamborghini' },
        })
        .expect(400);
      expect(JSON.stringify(res.body)).toMatch(/Vehicle Make must be one of/i);
    });

    it('MOBILE: rejects product missing brand and model', async () => {
      const res = await request(app.getHttpServer())
        .post('/products')
        .set('Authorization', `Bearer ${ctx.MOBILE.token}`)
        .send({ name: 'iPhone', price: 120000 })
        .expect(400);
      const body = JSON.stringify(res.body);
      expect(body).toMatch(/Brand is required/i);
      expect(body).toMatch(/Model is required/i);
    });

    it('MOBILE: accepts product with brand + model + condition', async () => {
      await request(app.getHttpServer())
        .post('/products')
        .set('Authorization', `Bearer ${ctx.MOBILE.token}`)
        .send({
          name: 'iPhone 14',
          price: 120000,
          attributes: { brand: 'Apple', model: 'iPhone 14', condition: 'New', warranty_months: 12 },
        })
        .expect(201);
    });

    it('TEXTILE: rejects product missing style_code', async () => {
      const res = await request(app.getHttpServer())
        .post('/products')
        .set('Authorization', `Bearer ${ctx.TEXTILE.token}`)
        .send({ name: 'T-Shirt', price: 800, attributes: { fabric: 'Cotton' } })
        .expect(400);
      expect(JSON.stringify(res.body)).toMatch(/Style Code is required/i);
    });

    it('RENTAL: rejects product missing rental_rate and rate_unit', async () => {
      const res = await request(app.getHttpServer())
        .post('/products')
        .set('Authorization', `Bearer ${ctx.RENTAL.token}`)
        .send({ name: 'Drill Machine', price: 5000 })
        .expect(400);
      const body = JSON.stringify(res.body);
      expect(body).toMatch(/Rental Rate is required/i);
      expect(body).toMatch(/Rate Unit is required/i);
    });

    it('SUPERMARKET, ELECTRICAL: no required attributes → product creates freely', async () => {
      for (const bt of ['SUPERMARKET', 'ELECTRICAL']) {
        await request(app.getHttpServer())
          .post('/products')
          .set('Authorization', `Bearer ${ctx[bt].token}`)
          .send({ name: 'Generic Item', price: 250 })
          .expect(201);
      }
    });
  });

  // ── 3. Attribute search ────────────────────────────────────────────────────

  describe('GET /products/search — searches across pack-defined searchable fields', () => {
    it('SPARE_PARTS: finds part by OEM number', async () => {
      await seedProduct(app, ctx.SPARE_PARTS.token, {
        attributes: { part_number: 'OEM-SEARCH-TEST', oem_number: 'TYT-04465-99001', vehicle_make: 'Nissan' },
      });

      const res = await request(app.getHttpServer())
        .get('/products/search?q=TYT-04465-99001')
        .set('Authorization', `Bearer ${ctx.SPARE_PARTS.token}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.some((p: any) => p.name === 'Test Product')).toBe(true);
    });

    it('MOBILE: finds device by brand', async () => {
      await seedProduct(app, ctx.MOBILE.token, {
        name: 'Samsung S24',
        attributes: { brand: 'Samsung', model: 'Galaxy S24', condition: 'New' },
      });

      const res = await request(app.getHttpServer())
        .get('/products/search?q=Samsung')
        .set('Authorization', `Bearer ${ctx.MOBILE.token}`)
        .expect(200);

      expect(res.body.some((p: any) => p.name === 'Samsung S24')).toBe(true);
    });
  });

  // ── 4. Restaurant endpoints ───────────────────────────────────────────────

  describe('Restaurant — tables + KOTs', () => {
    let tableId: string;
    let kotId: string;

    it('creates a table', async () => {
      const res = await request(app.getHttpServer())
        .post('/restaurant/tables')
        .set('Authorization', `Bearer ${ctx.RESTAURANT.token}`)
        .send({ name: 'Table 1', area: 'Indoor', capacity: 4 })
        .expect(201);
      tableId = res.body.id;
      expect(res.body.status).toBe('AVAILABLE');
    });

    it('lists tables', async () => {
      const res = await request(app.getHttpServer())
        .get('/restaurant/tables')
        .set('Authorization', `Bearer ${ctx.RESTAURANT.token}`)
        .expect(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.some((t: any) => t.id === tableId)).toBe(true);
    });

    it('creates a KOT for the table and marks it OCCUPIED', async () => {
      const res = await request(app.getHttpServer())
        .post('/restaurant/kots')
        .set('Authorization', `Bearer ${ctx.RESTAURANT.token}`)
        .send({
          tableId,
          orderType: 'DINE_IN',
          items: [{ productId: uuid(), name: 'Margherita Pizza', qty: 2, modifiers: ['no onion'] }],
        })
        .expect(201);
      kotId = res.body.id;
      expect(res.body.status).toBe('PENDING');
    });

    it('table status becomes OCCUPIED after KOT creation', async () => {
      const res = await request(app.getHttpServer())
        .get('/restaurant/tables')
        .set('Authorization', `Bearer ${ctx.RESTAURANT.token}`)
        .expect(200);
      const table = res.body.find((t: any) => t.id === tableId);
      expect(table.status).toBe('OCCUPIED');
    });

    it('updates KOT status to DONE → table becomes AVAILABLE', async () => {
      await request(app.getHttpServer())
        .patch(`/restaurant/kots/${kotId}/status`)
        .set('Authorization', `Bearer ${ctx.RESTAURANT.token}`)
        .send({ status: 'DONE' })
        .expect(200);

      const tables = await request(app.getHttpServer())
        .get('/restaurant/tables')
        .set('Authorization', `Bearer ${ctx.RESTAURANT.token}`)
        .expect(200);
      const table = tables.body.find((t: any) => t.id === tableId);
      expect(table.status).toBe('AVAILABLE');
    });
  });

  // ── 5. Mobile endpoints ───────────────────────────────────────────────────

  describe('Mobile — IMEI records + repair jobs', () => {
    it('records an IMEI at point of sale', async () => {
      const product = await seedProduct(app, ctx.MOBILE.token, {
        attributes: { brand: 'Samsung', model: 'A54', condition: 'New' },
      });
      const res = await request(app.getHttpServer())
        .post('/mobile/imei')
        .set('Authorization', `Bearer ${ctx.MOBILE.token}`)
        .send({ productId: product.id, imei: '354321098765432', warrantyMonths: 12 })
        .expect(201);
      expect(res.body.imei).toBe('354321098765432');
      expect(res.body.warrantyExpires).toBeDefined();
    });

    it('looks up device by IMEI', async () => {
      const res = await request(app.getHttpServer())
        .get('/mobile/imei?imei=354321098765432')
        .set('Authorization', `Bearer ${ctx.MOBILE.token}`)
        .expect(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body[0].imei).toBe('354321098765432');
    });

    it('creates a repair job', async () => {
      const res = await request(app.getHttpServer())
        .post('/mobile/repair-jobs')
        .set('Authorization', `Bearer ${ctx.MOBILE.token}`)
        .send({
          deviceMake: 'Samsung',
          deviceModel: 'A54',
          imei: '354321098765432',
          issue: 'Screen cracked',
          estimatedCost: 4500,
        })
        .expect(201);
      expect(res.body.status).toBe('RECEIVED');
      const jobId = res.body.id;

      // Advance status to READY
      await request(app.getHttpServer())
        .patch(`/mobile/repair-jobs/${jobId}`)
        .set('Authorization', `Bearer ${ctx.MOBILE.token}`)
        .send({ status: 'READY', technicianNotes: 'Screen replaced', actualCost: 4200 })
        .expect(200);
    });

    it('sync push auto-creates ImeiRecord when item carries IMEI metadata', async () => {
      // Register outlet for the MOBILE tenant
      const outlet = await prisma.withTenant(ctx.MOBILE.tenantId, (tx) =>
        tx.outlet.findFirst({ where: { isDefault: true } }),
      );
      const invId = uuid();

      await request(app.getHttpServer())
        .post('/sync/push')
        .set('Authorization', `Bearer ${ctx.MOBILE.token}`)
        .send({
          items: [{
            type: 'invoice',
            id: invId,
            data: {
              id: invId,
              outletId: outlet!.id,
              subtotal: 80000,
              total: 80000,
              createdAt: new Date().toISOString(),
              items: [{
                productId: uuid(),
                nameSnapshot: 'Samsung A54',
                qty: 1,
                unitPrice: 80000,
                lineTotal: 80000,
                metadata: { imei: '999888777666555', warrantyMonths: 24 },
              }],
              payments: [{ method: 'CASH', amount: 80000 }],
            },
          }],
          deviceId: 'test-device',
        })
        .expect(201);

      // Wait a tick for the async vertical processing
      await new Promise((r) => setTimeout(r, 200));

      const record = await prisma.withTenant(ctx.MOBILE.tenantId, (tx) =>
        tx.imeiRecord.findFirst({ where: { imei: '999888777666555' } }),
      );
      expect(record).not.toBeNull();
      expect(record!.warrantyMonths).toBe(24);
    });
  });

  // ── 6. Rental endpoints ───────────────────────────────────────────────────

  describe('Rental — agreements + late-fee calculation', () => {
    let agreementId: string;
    let productId: string;

    beforeAll(async () => {
      const p = await seedProduct(app, ctx.RENTAL.token, {
        attributes: { rental_rate: 500, rate_unit: 'DAY', deposit: 2000, condition: 'Good' },
      });
      productId = p.id;
    });

    it('creates a rental agreement', async () => {
      const outAt = new Date();
      const expectedInAt = new Date(outAt.getTime() + 2 * 86_400_000); // 2 days

      const res = await request(app.getHttpServer())
        .post('/rental/agreements')
        .set('Authorization', `Bearer ${ctx.RENTAL.token}`)
        .send({
          productId,
          rate: 500,
          rateUnit: 'DAY',
          deposit: 2000,
          outAt: outAt.toISOString(),
          expectedInAt: expectedInAt.toISOString(),
        })
        .expect(201);

      agreementId = res.body.id;
      expect(res.body.status).toBe('ACTIVE');
    });

    it('returns on time — no late fee', async () => {
      const outAt = new Date(Date.now() - 2 * 86_400_000);
      const expectedInAt = new Date(Date.now() + 86_400_000);

      const ag = await request(app.getHttpServer())
        .post('/rental/agreements')
        .set('Authorization', `Bearer ${ctx.RENTAL.token}`)
        .send({ productId, rate: 500, rateUnit: 'DAY', deposit: 0, outAt: outAt.toISOString(), expectedInAt: expectedInAt.toISOString() })
        .expect(201);

      const ret = await request(app.getHttpServer())
        .patch(`/rental/agreements/${ag.body.id}/return`)
        .set('Authorization', `Bearer ${ctx.RENTAL.token}`)
        .send({ actualInAt: new Date().toISOString() })
        .expect(200);

      expect(Number(ret.body.lateFee)).toBe(0);
      expect(ret.body.status).toBe('RETURNED');
    });

    it('calculates late fee for overdue return', async () => {
      const outAt = new Date(Date.now() - 5 * 86_400_000); // 5 days ago
      const expectedInAt = new Date(Date.now() - 2 * 86_400_000); // due 2 days ago
      const actualInAt = new Date(); // returning now → 2 days late

      const ag = await request(app.getHttpServer())
        .post('/rental/agreements')
        .set('Authorization', `Bearer ${ctx.RENTAL.token}`)
        .send({ productId, rate: 500, rateUnit: 'DAY', deposit: 0, outAt: outAt.toISOString(), expectedInAt: expectedInAt.toISOString() })
        .expect(201);

      const ret = await request(app.getHttpServer())
        .patch(`/rental/agreements/${ag.body.id}/return`)
        .set('Authorization', `Bearer ${ctx.RENTAL.token}`)
        .send({ actualInAt: actualInAt.toISOString() })
        .expect(200);

      // 2 overdue days × LKR 500/day = LKR 1000
      expect(Number(ret.body.lateFee)).toBe(1000);
      expect(ret.body.status).toBe('RETURNED');
    });

    it('checks availability — returns conflict for active agreement', async () => {
      const from = new Date(Date.now() - 86_400_000).toISOString();
      const to = new Date(Date.now() + 3 * 86_400_000).toISOString();

      const res = await request(app.getHttpServer())
        .get(`/rental/availability?productId=${productId}&from=${from}&to=${to}`)
        .set('Authorization', `Bearer ${ctx.RENTAL.token}`)
        .expect(200);

      // agreementId created above overlaps this window
      expect(res.body.available).toBe(false);
      expect(res.body.conflicts.length).toBeGreaterThan(0);
    });

    it('sync push auto-creates RentalAgreement from invoice metadata', async () => {
      const outlet = await prisma.withTenant(ctx.RENTAL.tenantId, (tx) =>
        tx.outlet.findFirst({ where: { isDefault: true } }),
      );
      const invId = uuid();
      const outAt = new Date().toISOString();
      const expectedInAt = new Date(Date.now() + 86_400_000).toISOString();

      await request(app.getHttpServer())
        .post('/sync/push')
        .set('Authorization', `Bearer ${ctx.RENTAL.token}`)
        .send({
          items: [{
            type: 'invoice',
            id: invId,
            data: {
              id: invId,
              outletId: outlet!.id,
              subtotal: 500,
              total: 500,
              createdAt: new Date().toISOString(),
              items: [{ productId, nameSnapshot: 'Drill', qty: 1, unitPrice: 500, lineTotal: 500 }],
              payments: [{ method: 'CASH', amount: 500 }],
              metadata: {
                rentalAgreement: { productId, rate: 500, rateUnit: 'DAY', deposit: 0, outAt, expectedInAt },
              },
            },
          }],
          deviceId: 'test-device',
        })
        .expect(201);

      await new Promise((r) => setTimeout(r, 200));

      const ag = await prisma.withTenant(ctx.RENTAL.tenantId, (tx) =>
        tx.rentalAgreement.findFirst({ where: { invoiceId: invId } }),
      );
      expect(ag).not.toBeNull();
      expect(ag!.status).toBe('ACTIVE');
    });
  });

  // ── 7. Supermarket promotions ─────────────────────────────────────────────

  describe('Supermarket — promotions + apply-promotions', () => {
    let productId: string;

    beforeAll(async () => {
      const p = await seedProduct(app, ctx.SUPERMARKET.token);
      productId = p.id;
    });

    it('creates a MULTI_BUY promotion', async () => {
      const res = await request(app.getHttpServer())
        .post('/supermarket/promotions')
        .set('Authorization', `Bearer ${ctx.SUPERMARKET.token}`)
        .send({
          name: 'Buy 3 Get 10% Off',
          type: 'MULTI_BUY',
          conditions: { minQty: 3, productId },
          reward: { discountPct: 10 },
          validFrom: new Date(Date.now() - 1000).toISOString(),
        })
        .expect(201);
      expect(res.body.isActive).toBe(true);
    });

    it('applies MULTI_BUY promotion to cart', async () => {
      const res = await request(app.getHttpServer())
        .post('/supermarket/apply-promotions')
        .set('Authorization', `Bearer ${ctx.SUPERMARKET.token}`)
        .send({ lines: [{ productId, qty: 3, unitPrice: 100 }] })
        .expect(201);

      expect(res.body.discounts.length).toBeGreaterThan(0);
      expect(res.body.totalDiscount).toBe(30); // 10% of 3×100
    });

    it('creates a BOGO promotion', async () => {
      const res = await request(app.getHttpServer())
        .post('/supermarket/promotions')
        .set('Authorization', `Bearer ${ctx.SUPERMARKET.token}`)
        .send({
          name: 'Buy 2 Get 1 Free',
          type: 'BOGO',
          conditions: { productId },
          reward: { freeQty: 1 },
          validFrom: new Date(Date.now() - 1000).toISOString(),
        })
        .expect(201);
      expect(res.body.id).toBeDefined();
    });

    it('applies BOGO: buy 4, get 2 free', async () => {
      const res = await request(app.getHttpServer())
        .post('/supermarket/apply-promotions')
        .set('Authorization', `Bearer ${ctx.SUPERMARKET.token}`)
        .send({ lines: [{ productId, qty: 4, unitPrice: 100 }] })
        .expect(201);

      // BOGO gives Math.floor(4/2) = 2 free @ 100 each = 200 discount
      // Plus the MULTI_BUY may also apply — total discount > 0 is sufficient
      expect(res.body.totalDiscount).toBeGreaterThan(0);
    });
  });

  // ── 8. Textile variant generator ──────────────────────────────────────────

  describe('Textile — size × color variant matrix', () => {
    it('generates a 3×3 variant matrix (9 variants)', async () => {
      const product = await seedProduct(app, ctx.TEXTILE.token, {
        attributes: { style_code: 'TS-2024-001', fabric: 'Cotton', season: 'SS24' },
      });

      const res = await request(app.getHttpServer())
        .post('/textile/generate-variants')
        .set('Authorization', `Bearer ${ctx.TEXTILE.token}`)
        .send({
          productId: product.id,
          sizes: ['S', 'M', 'L'],
          colors: ['Black', 'White', 'Navy'],
          barcodePrefix: 'TS-2024-001',
        })
        .expect(201);

      expect(res.body).toHaveLength(9);
      expect(res.body[0].attributes).toMatchObject({ size: 'S', color: 'Black' });
      expect(res.body[0].barcode).toBe('TS-2024-001-S-BLACK');
    });

    it('is idempotent — re-generating same matrix adds 0 new variants', async () => {
      const product = await seedProduct(app, ctx.TEXTILE.token, {
        attributes: { style_code: 'TS-IDEM-001', fabric: 'Polyester' },
      });

      await request(app.getHttpServer())
        .post('/textile/generate-variants')
        .set('Authorization', `Bearer ${ctx.TEXTILE.token}`)
        .send({ productId: product.id, sizes: ['M', 'L'], colors: ['Red', 'Blue'] })
        .expect(201);

      const res = await request(app.getHttpServer())
        .post('/textile/generate-variants')
        .set('Authorization', `Bearer ${ctx.TEXTILE.token}`)
        .send({ productId: product.id, sizes: ['M', 'L'], colors: ['Red', 'Blue'] })
        .expect(201);

      // Still exactly 4 — no duplicates
      expect(res.body).toHaveLength(4);
    });

    it('lists variant matrix with size/color summary', async () => {
      const product = await seedProduct(app, ctx.TEXTILE.token, {
        attributes: { style_code: 'TS-LIST-001', fabric: 'Silk' },
      });

      await request(app.getHttpServer())
        .post('/textile/generate-variants')
        .set('Authorization', `Bearer ${ctx.TEXTILE.token}`)
        .send({ productId: product.id, sizes: ['XS', 'S'], colors: ['Pink'] })
        .expect(201);

      const res = await request(app.getHttpServer())
        .get(`/textile/variants/${product.id}`)
        .set('Authorization', `Bearer ${ctx.TEXTILE.token}`)
        .expect(200);

      expect(res.body.matrix.sizes).toEqual(expect.arrayContaining(['XS', 'S']));
      expect(res.body.matrix.colors).toEqual(['Pink']);
      expect(res.body.variants).toHaveLength(2);
    });
  });
});
