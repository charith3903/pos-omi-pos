import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterTenantDto } from './dto/register-tenant.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * POST /auth/register-tenant
   * Creates a new tenant with an OWNER user and a default outlet.
   * Returns access + refresh tokens immediately.
   */
  @Post('register-tenant')
  @HttpCode(HttpStatus.CREATED)
  registerTenant(@Body() dto: RegisterTenantDto) {
    return this.authService.registerTenant(dto);
  }

  /**
   * POST /auth/login
   * Body: { subdomain, email, password }
   * Returns: { user, accessToken, refreshToken }
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  /**
   * POST /auth/refresh
   * Body: { refreshToken }
   * Returns: { accessToken }
   */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('jwt-refresh'))
  refresh(@CurrentUser() user: { userId: string; tenantId: string }) {
    return this.authService.refresh(user.userId, user.tenantId);
  }

  /**
   * GET /auth/me
   * Returns the authenticated user (no password hash).
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMe(@CurrentUser() user: RequestUser) {
    return this.authService.getMe(user.userId, user.tenantId);
  }
}
