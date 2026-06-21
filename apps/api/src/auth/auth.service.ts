import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import { AuthTokens, JwtPayload } from '@omnipos/types';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterTenantDto } from './dto/register-tenant.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  // ─── Register ─────────────────────────────────────────────────────────────

  async registerTenant(dto: RegisterTenantDto) {
    const existing = await this.prisma.tenant.findUnique({
      where: { subdomain: dto.subdomain },
    });
    if (existing) throw new ConflictException('Subdomain already taken');

    const passwordHash = await argon2.hash(dto.password);

    // One transaction: create tenant (no RLS) → set tenant context → create
    // default outlet + owner user (RLS now satisfied because tenantId matches
    // the current_setting we just set inside the transaction).
    const result = await this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: dto.tenantName,
          subdomain: dto.subdomain,
          businessType: dto.businessType,
        },
      });

      // Activate RLS context for all subsequent writes in this transaction.
      await tx.$executeRaw`SELECT set_config('app.current_tenant', ${tenant.id}, true)`;

      const [outlet, user] = await Promise.all([
        tx.outlet.create({
          data: {
            tenantId: tenant.id,
            name: `${tenant.name} Main`,
            isDefault: true,
          },
        }),
        tx.user.create({
          data: {
            tenantId: tenant.id,
            name: dto.ownerName,
            email: dto.email,
            phone: dto.phone,
            passwordHash,
            role: 'OWNER',
          },
        }),
      ]);

      return { tenant, outlet, user };
    });

    const tokens = this.issueTokens(result.user);
    return {
      tenant: result.tenant,
      user: this.sanitize(result.user),
      ...tokens,
    };
  }

  // ─── Login ────────────────────────────────────────────────────────────────

  async login(dto: LoginDto) {
    // Step 1: resolve tenant (tenants table has no RLS)
    const tenant = await this.prisma.tenant.findUnique({
      where: { subdomain: dto.subdomain },
    });
    if (!tenant) throw new UnauthorizedException('Invalid credentials');

    // Step 2: look up user within tenant context (RLS enforced)
    const user = await this.prisma.withTenant(tenant.id, (tx) =>
      tx.user.findFirst({ where: { email: dto.email, tenantId: tenant.id } }),
    );
    if (!user) throw new UnauthorizedException('Invalid credentials');

    // Step 3: verify password (constant-time comparison via argon2)
    const valid = await argon2.verify(user.passwordHash, dto.password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    return { user: this.sanitize(user), ...this.issueTokens(user) };
  }

  // ─── Refresh ──────────────────────────────────────────────────────────────

  async refresh(userId: string, tenantId: string): Promise<{ accessToken: string }> {
    const user = await this.prisma.withTenant(tenantId, (tx) =>
      tx.user.findUnique({ where: { id: userId } }),
    );
    if (!user) throw new UnauthorizedException();
    return { accessToken: this.issueTokens(user).accessToken };
  }

  // ─── Me ───────────────────────────────────────────────────────────────────

  async getMe(userId: string, tenantId: string) {
    const user = await this.prisma.withTenant(tenantId, (tx) =>
      tx.user.findUnique({ where: { id: userId } }),
    );
    if (!user) throw new UnauthorizedException();
    return this.sanitize(user);
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private issueTokens(user: User): AuthTokens {
    const base: Omit<JwtPayload, 'type'> = {
      sub: user.id,
      tenantId: user.tenantId,
      role: user.role as any,
    };

    return {
      accessToken: this.jwtService.sign(
        { ...base, type: 'access' },
        {
          secret: this.config.getOrThrow('JWT_SECRET'),
          expiresIn: this.config.get('JWT_EXPIRES_IN', '15m'),
        },
      ),
      refreshToken: this.jwtService.sign(
        { sub: base.sub, tenantId: base.tenantId, type: 'refresh' },
        {
          secret: this.config.getOrThrow('JWT_REFRESH_SECRET'),
          expiresIn: this.config.get('JWT_REFRESH_EXPIRES_IN', '7d'),
        },
      ),
    };
  }

  /** Strip the password hash before returning a user to the caller. */
  private sanitize(user: User): Omit<User, 'passwordHash'> {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, ...safe } = user;
    return safe;
  }
}
