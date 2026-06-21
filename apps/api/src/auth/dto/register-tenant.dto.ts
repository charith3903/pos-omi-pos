import { IsEmail, IsEnum, IsOptional, IsString, Matches, MinLength } from 'class-validator';
import { BusinessType } from '@omnipos/types';

export class RegisterTenantDto {
  @IsString()
  tenantName: string;

  /** Must be URL-safe: lowercase letters, digits, hyphens only */
  @IsString()
  @Matches(/^[a-z0-9-]+$/, { message: 'subdomain must be lowercase letters, digits, and hyphens' })
  subdomain: string;

  @IsEnum(['SPARE_PARTS', 'RESTAURANT', 'ELECTRICAL', 'SUPERMARKET', 'TEXTILE', 'MOBILE', 'RENTAL'])
  businessType: BusinessType;

  @IsString()
  ownerName: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsString()
  @MinLength(8, { message: 'password must be at least 8 characters' })
  password: string;
}
