/**
 * Seed script — creates one demo tenant per business type (shop type) so
 * every vertical can be logged into without going through the registration
 * flow.
 *
 * Run with:  npm run seed -w apps/api
 *
 * See the console output at the end of the run for the full credentials
 * table (subdomain / email / password per shop type).
 */

import { PrismaClient, BusinessType } from '@prisma/client';
import * as argon2 from 'argon2';
import { getPackForBusinessType } from '../src/vertical/packs/registry';

interface DemoShop {
  businessType: BusinessType;
  subdomain: string;
  tenantName: string;
  outletName: string;
}

// One demo tenant per business type ("shop type") the platform supports.
const DEMO_SHOPS: DemoShop[] = [
  { businessType: 'SUPERMARKET', subdomain: 'demo-supermarket', tenantName: 'Demo Supermarket', outletName: 'Demo Supermarket Main' },
  { businessType: 'RESTAURANT', subdomain: 'demo-restaurant', tenantName: 'Demo Restaurant', outletName: 'Demo Restaurant Main' },
  { businessType: 'SPARE_PARTS', subdomain: 'demo-spareparts', tenantName: 'Demo Spare Parts', outletName: 'Demo Spare Parts Main' },
  { businessType: 'ELECTRICAL', subdomain: 'demo-electrical', tenantName: 'Demo Electrical', outletName: 'Demo Electrical Main' },
  { businessType: 'TEXTILE', subdomain: 'demo-textile', tenantName: 'Demo Textile', outletName: 'Demo Textile Main' },
  { businessType: 'MOBILE', subdomain: 'demo-mobile', tenantName: 'Demo Mobile Shop', outletName: 'Demo Mobile Shop Main' },
  { businessType: 'RENTAL', subdomain: 'demo-rental', tenantName: 'Demo Rental', outletName: 'Demo Rental Main' },
];

const DEMO_EMAIL = 'admin@demo.com';
const DEMO_PASSWORD = 'admin123';

// Seed always uses the superuser connection so it can bypass RLS
// (the app itself uses omnipos_app which enforces RLS)
const SEED_DB_URL = process.env.SEED_DATABASE_URL
  ?? 'postgresql://omnipos:omnipos@localhost:5433/omnipos_db';

const prisma = new PrismaClient({ datasources: { db: { url: SEED_DB_URL } } });

async function seedShop(shop: DemoShop) {
  const pack = getPackForBusinessType(shop.businessType);

  const plan = await prisma.plan.upsert({
    where: { businessType: shop.businessType },
    update: { includedModules: pack.enabledModules },
    create: {
      businessType: shop.businessType,
      name: `${shop.businessType.replace('_', ' ')} Plan`,
      priceUsdMonthly: 29,
      priceUsdAnnual: 290,
      priceLkrMonthly: 4990,
      priceLkrAnnual: 49900,
      trialDays: 14,
      includedModules: pack.enabledModules,
    },
  });

  const tenant = await prisma.tenant.upsert({
    where: { subdomain: shop.subdomain },
    update: {},
    create: {
      name: shop.tenantName,
      subdomain: shop.subdomain,
      businessType: shop.businessType,
      plan: 'STARTER',
      status: 'ACTIVE',
    },
  });

  await prisma.$executeRaw`SELECT set_config('app.current_tenant', ${tenant.id}, true)`;

  const existingOutlet = await prisma.outlet.findFirst({
    where: { tenantId: tenant.id, isDefault: true },
  });
  if (!existingOutlet) {
    await prisma.outlet.create({
      data: { tenantId: tenant.id, name: shop.outletName, isDefault: true },
    });
  }

  await prisma.subscription.upsert({
    where: { tenantId: tenant.id },
    update: {},
    create: {
      tenantId: tenant.id,
      planId: plan.id,
      status: 'ACTIVE',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    },
  });

  const passwordHash = await argon2.hash(DEMO_PASSWORD);
  const existingUser = await prisma.user.findFirst({
    where: { tenantId: tenant.id, email: DEMO_EMAIL },
  });

  if (!existingUser) {
    await prisma.user.create({
      data: {
        tenantId: tenant.id,
        name: 'Admin User',
        email: DEMO_EMAIL,
        passwordHash,
        role: 'OWNER',
      },
    });
  } else {
    await prisma.user.update({
      where: { id: existingUser.id },
      data: { passwordHash },
    });
  }

  console.log(`✅  ${shop.businessType.padEnd(11)} → subdomain: ${shop.subdomain}`);
}

async function main() {
  console.log('🌱  Seeding demo data for every shop type…\n');

  for (const shop of DEMO_SHOPS) {
    await seedShop(shop);
  }

  console.log('\n🎉  Done! Login credentials (same email/password across all shops):\n');
  console.log(`    Email    : ${DEMO_EMAIL}`);
  console.log(`    Password : ${DEMO_PASSWORD}\n`);
  console.log('    Shop type      | Subdomain');
  console.log('    ---------------|-----------------------');
  for (const shop of DEMO_SHOPS) {
    console.log(`    ${shop.businessType.padEnd(14)} | ${shop.subdomain}`);
  }
}

main()
  .catch((e) => {
    console.error('❌  Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
