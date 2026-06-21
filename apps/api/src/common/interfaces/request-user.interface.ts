import { UserRole } from '@omnipos/types';

export interface RequestUser {
  userId: string;
  tenantId: string;
  role: UserRole;
  email?: string;
  name?: string;
}
