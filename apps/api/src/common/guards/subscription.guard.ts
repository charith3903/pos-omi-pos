import { CanActivate, ExecutionContext, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { getPackForBusinessType } from '../../vertical/packs/registry';
import { PrismaService } from '../../prisma/prisma.service';
import { REQUIRES_MODULE_KEY } from '../decorators/requires-module.decorator';
import { SubscriptionRequiredException } from '../exceptions/subscription-required.exception';
import { RequestUser } from '../interfaces/request-user.interface';

/**
 * Runs after JwtAuthGuard (per-controller, same convention as RolesGuard —
 * see roles.guard.ts; there is no global APP_GUARD in this codebase, and
 * introducing SubscriptionGuard as one would run it before JwtAuthGuard
 * attaches `request.user`, breaking the tenantId lookup below).
 *
 * Exempt controllers (never add this guard): AuthController (login/register
 * must work regardless of subscription state), BillingWebhooksController
 * (gateways call it unauthenticated — a webhook for a SUSPENDED tenant is
 * exactly the request that must go through), HealthController.
 */
@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user: RequestUser = request.user;

    // `tenants` has no RLS (resolved before any tenant context exists), so
    // this is a plain findUnique — no withTenant needed.
    const tenant = await this.prisma.tenant.findUnique({ where: { id: user.tenantId } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const trialExpired = tenant.status === 'TRIAL' && !!tenant.trialEndsAt && tenant.trialEndsAt < new Date();
    if (tenant.status === 'SUSPENDED' || trialExpired) {
      throw new SubscriptionRequiredException(
        trialExpired ? 'Your trial has ended — please subscribe to continue' : 'Your subscription is suspended',
      );
    }

    const requiredModule = this.reflector.getAllAndOverride<string | undefined>(REQUIRES_MODULE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredModule) return true;

    const pack = getPackForBusinessType(tenant.businessType);
    if (!pack.enabledModules.includes(requiredModule)) {
      throw new ForbiddenException(`Module '${requiredModule}' is not available for this business type`);
    }

    const entitled = await this.prisma.withTenant(tenant.id, async (tx) => {
      const subscription = await tx.subscription.findUnique({
        where: { tenantId: tenant.id },
        include: { plan: true, addOns: { include: { addOnModule: true } } },
      });
      if (!subscription) return false;
      if (subscription.plan.includedModules.includes(requiredModule)) return true;
      return subscription.addOns.some(
        (a) => a.status === 'ACTIVE' && a.addOnModule.moduleKey === requiredModule,
      );
    });

    if (!entitled) {
      throw new SubscriptionRequiredException(`Module '${requiredModule}' requires a paid add-on`);
    }

    return true;
  }
}
