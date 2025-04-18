import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RateLimitService } from './rate-limit.service';
import { Request } from 'express';
export const RATE_LIMIT_KEY = 'rate_limit';
export const RateLimit = (key: string, maxRequests?: number) => {
  return SetMetadata(RATE_LIMIT_KEY, { key, maxRequests });
};

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private rateLimitService: RateLimitService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const rateLimitMeta = this.reflector.get<{
      key: string;
      maxRequests?: number;
    }>(RATE_LIMIT_KEY, context.getHandler());

    if (!rateLimitMeta) {
      return true;
    }

    const { key, maxRequests } = rateLimitMeta;
    const request = context.switchToHttp().getRequest<Request>();

    const result = await this.rateLimitService.checkRateLimit(
      key,
      request,
      maxRequests,
    );

    if (!result.allowed) {
      throw new HttpException(
        {
          message: 'Too many requests',
          data: {
            retryAfter: result.remainingTime,
            currentCount: result.currentCount,
            ip: result.ip,
          },
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}
