import { SetMetadata } from '@nestjs/common';

export const REQUIRES_MODULE_KEY = 'requiresModule';

/**
 * Marks a controller/handler as belonging to a specific vertical-pack
 * module (e.g. 'mobile', 'warranty', 'purchasing' — matches the keys in
 * VerticalPack.enabledModules). SubscriptionGuard checks two things for a
 * tagged route: (1) the tenant's business type pack actually lists this
 * module — wrong-vertical tenants are hard-blocked regardless of payment —
 * and (2) the tenant's plan/add-ons actually include it. Mirrors the
 * `@Roles()` decorator's shape (see roles.decorator.ts).
 */
export const RequiresModule = (moduleKey: string) => SetMetadata(REQUIRES_MODULE_KEY, moduleKey);
