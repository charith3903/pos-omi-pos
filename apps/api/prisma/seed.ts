/**
 * Seed script — creates a demo tenant + owner user so you can log in
 * without going through the registration flow.
 *
 * Login credentials:
 *   Subdomain : demo
 *   Email     : admin@demo.com
 *   Password  : admin123
 *
 * Run with:  npm run seed -w apps/api
 */

import { PrismaClient, BusinessType } from '@prisma/client';
import * as argon2 from 'argon2';

// Seed always uses the superuser connection so it can bypass RLS
// (the app itself uses omnipos_app which enforces RLS)
const SEED_DB_URL = process.env.SEED_DATABASE_URL
  ?? 'postgresql://omnipos:omnipos@localhost:5433/omnipos_db';

const prisma = new PrismaClient({ datasources: { db: { url: SEED_DB_URL } } });


async function main() {
  console.log('🌱  Seeding demo data…');

  // ── 1. Upsert tenant ────────────────────────────────────────────────────────
  const tenant = await prisma.tenant.upsert({
    where: { subdomain: 'demo' },
    update: {},
    create: {
      name: 'Demo Store',
      subdomain: 'demo',
      businessType: BusinessType.SUPERMARKET,
      plan: 'STARTER',
      status: 'ACTIVE',
    },
  });

  console.log(`✅  Tenant: ${tenant.name}  (id: ${tenant.id})`);

  // ── 2. Upsert default outlet ─────────────────────────────────────────────────
  const existingOutlet = await prisma.outlet.findFirst({
    where: { tenantId: tenant.id, isDefault: true },
  });

  if (!existingOutlet) {
    await prisma.$executeRaw`SELECT set_config('app.current_tenant', ${tenant.id}, true)`;
    await prisma.outlet.create({
      data: {
        tenantId: tenant.id,
        name: 'Demo Store Main',
        isDefault: true,
      },
    });
    console.log('✅  Default outlet created');
  } else {
    console.log('ℹ️   Default outlet already exists, skipping');
  }

  // ── 3. Upsert owner user ─────────────────────────────────────────────────────
  const email = 'admin@demo.com';
  const passwordHash = await argon2.hash('admin123');

  const existingUser = await prisma.user.findFirst({
    where: { tenantId: tenant.id, email },
  });

  if (!existingUser) {
    await prisma.$executeRaw`SELECT set_config('app.current_tenant', ${tenant.id}, true)`;
    const user = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        name: 'Admin User',
        email,
        passwordHash,
        role: 'OWNER',
      },
    });
    console.log(`✅  User created: ${user.email}  role: ${user.role}`);
  } else {
    // Always refresh the password hash in case they want to reset it
    await prisma.$executeRaw`SELECT set_config('app.current_tenant', ${tenant.id}, true)`;
    await prisma.user.update({
      where: { id: existingUser.id },
      data: { passwordHash },
    });
    console.log(`ℹ️   User already exists — password reset to "admin123"`);
  }

  console.log('\n🎉  Done! Login credentials:');
  console.log('    Subdomain : demo');
  console.log('    Email     : admin@demo.com');
  console.log('    Password  : admin123');
}

main()
  .catch((e) => {
    console.error('❌  Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
