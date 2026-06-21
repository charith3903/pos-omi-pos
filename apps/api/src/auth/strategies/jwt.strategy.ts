import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { JwtPayload } from '@omnipos/types';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { RequestUser } from '../../common/interfaces/request-user.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
      ignoreExpiration: false,
    });
  }

  validate(payload: JwtPayload): RequestUser {
    if (payload.type !== 'access') throw new UnauthorizedException('Invalid token type');
    return {
      userId: payload.sub,
      tenantId: payload.tenantId,
      role: payload.role!,
    };
  }
}
