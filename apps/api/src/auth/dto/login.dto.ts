import { IsEmail, IsString, Matches } from 'class-validator';

export class LoginDto {
  @IsString()
  @Matches(/^[a-z0-9-]+$/, { message: 'subdomain must be lowercase letters, digits, and hyphens' })
  subdomain: string;

  @IsEmail()
  email: string;

  @IsString()
  password: string;
}
