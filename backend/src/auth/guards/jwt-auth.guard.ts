import { ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const url = request.url;
    const authHeader = request.headers?.authorization;

    if (err || !user) {
      const reason = info?.message || info?.name || err?.message || 'unknown';
      const hasToken = !!authHeader;
      this.logger.warn(
        `JWT 인증 실패: url=${url}, reason=${reason}, hasToken=${hasToken}, tokenPrefix=${authHeader?.substring(0, 15) || 'none'}`,
      );
    }

    return super.handleRequest(err, user, info, context);
  }
}
