import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, RedisClientType } from 'redis';
import { Request } from 'express';

@Injectable()
export class RateLimitService {
  private redis: RedisClientType;
  private readonly RATE_LIMIT_RESET: number;
  private readonly DEFAULT_MAX_REQUESTS: number;

  constructor(private configService: ConfigService) {
    this.redis = createClient({
      url: this.configService.get('REDIS_URI'),
    });
    this.redis.connect();

    this.RATE_LIMIT_RESET = this.configService.get<number>(
      'RATE_LIMIT_RESET',
      60,
    );
    this.DEFAULT_MAX_REQUESTS = this.configService.get<number>(
      'DEFAULT_MAX_REQUESTS',
      10,
    );
  }

  private getKey(key: string, ip: string, email?: string): string {
    if (email) {
      return `rate_limit:${key}:${email}:${ip}`;
    }
    return `rate_limit:${key}:${ip}`;
  }

  private getUsernameIPkey(username: string, ip: string): string {
    return `${username}_${ip}`;
  }

  private getClientIp(request: Request): string {
    let ip = request.ip;
    if (!ip) {
      const forwardedFor = request.headers['x-forwarded-for'];
      if (Array.isArray(forwardedFor)) {
        ip = forwardedFor[0];
      } else if (typeof forwardedFor === 'string') {
        ip = forwardedFor.split(',')[0];
      }
    }
    if (!ip && request.socket) {
      ip = request.socket.remoteAddress;
    }
    return ip || '0.0.0.0';
  }

  private async handleMaxRequests(
    blockStartKey: string,
    currentTime: number,
    count: number,
  ) {
    // Get or set block start time
    const blockStartTime = await this.redis.get(blockStartKey);
    let timeDifferenceInSeconds = 0;

    if (!blockStartTime) {
      // First time reaching max requests, set block start time
      await this.redis.set(blockStartKey, currentTime.toString(), {
        EX: this.RATE_LIMIT_RESET,
      });
    } else {
      // Calculate time difference from block start
      timeDifferenceInSeconds = (currentTime - parseInt(blockStartTime)) / 1000;
    }

    const remainingTime = Math.ceil(
      this.RATE_LIMIT_RESET - timeDifferenceInSeconds,
    );

    return {
      allowed: false,
      remainingTime,
      currentCount: count,
    };
  }

  async checkRateLimit(
    key: string,
    request: Request,
    maxRequests: number = this.DEFAULT_MAX_REQUESTS,
    email?: string,
  ): Promise<{
    allowed: boolean;
    remainingTime?: number;
    currentCount?: number;
    ip?: string;
  }> {
    const ip = this.getClientIp(request);
    const redisKey = this.getKey(key, ip, email);
    const blockStartKey = `${redisKey}:block_start`;

    // Get current data
    const data = await this.redis.hGetAll(redisKey);
    const currentTime = Date.now();

    // If no data exists, create new record
    if (!Object.keys(data).length) {
      await Promise.all([
        this.redis.hSet(redisKey, 'createdAt', currentTime.toString()),
        this.redis.hSet(redisKey, 'count', '1'),
      ]);
      return { allowed: true, currentCount: 1, ip };
    }

    const createdAt = parseInt(data.createdAt);
    const count = parseInt(data.count);
    const timeDifferenceInSeconds = (currentTime - createdAt) / 1000;

    // If more than 1 minute has passed, reset the counter
    if (timeDifferenceInSeconds >= this.RATE_LIMIT_RESET) {
      await Promise.all([
        this.redis.hSet(redisKey, 'createdAt', currentTime.toString()),
        this.redis.hSet(redisKey, 'count', '1'),
        this.redis.del(blockStartKey),
      ]);
      return { allowed: true, currentCount: 1, ip };
    }

    // If within time window but exceeded limit
    if (count >= maxRequests) {
      const result = await this.handleMaxRequests(
        blockStartKey,
        currentTime,
        count,
      );
      return { ...result, ip };
    }

    // Increment count
    const newCount = count + 1;
    await this.redis.hSet(redisKey, 'count', newCount.toString());

    return {
      allowed: true,
      currentCount: newCount,
      ip,
    };
  }

  async checkLoginAttempts(
    email: string,
    ip: string,
    failedAttemptsPerBlock: number,
    blockPeriods: number[],
  ): Promise<{ retrySecs: number; blockDuration: number }> {
    const usernameIPkey = this.getUsernameIPkey(email, ip);

    const failedKey = `failed_attempts:${usernameIPkey}`;
    const failedAttempts = await this.redis.get(failedKey);
    const attempts = failedAttempts ? parseInt(failedAttempts) : 0;

    if (attempts >= failedAttemptsPerBlock) {
      // Calculate block index based on number of failed attempts
      const blockIndex = Math.min(
        Math.floor(attempts / failedAttemptsPerBlock) - 1,
        blockPeriods.length - 1,
      );
      const blockDuration = blockPeriods[blockIndex];

      // Get remaining time from Redis
      const remainingTime = await this.redis.ttl(`block:${usernameIPkey}`);
      const retrySecs = remainingTime > 0 ? remainingTime : 0;
      return { retrySecs, blockDuration };
    }

    return { retrySecs: 0, blockDuration: 0 };
  }

  async handleFailedLogin(
    email: string,
    ip: string,
    failedAttemptsPerBlock: number,
    blockPeriods: number[],
  ): Promise<void> {
    const usernameIPkey = this.getUsernameIPkey(email, ip);

    // Increment failed attempts in Redis
    const failedAttempts = await this.redis.incr(
      `failed_attempts:${usernameIPkey}`,
    );

    // Only block if attempts is divisible by FAILED_ATTEMPTS_PER_BLOCK
    if (failedAttempts % failedAttemptsPerBlock === 0) {
      const blockIndex = Math.min(
        Math.floor(failedAttempts / failedAttemptsPerBlock) - 1,
        blockPeriods.length - 1,
      );
      const blockDuration = blockPeriods[blockIndex];

      // Set block duration in Redis
      await this.redis.set(`block:${usernameIPkey}`, '1', {
        EX: blockDuration,
      });
    }
  }

  async resetLoginAttempts(email: string, ip: string): Promise<void> {
    const usernameIPkey = this.getUsernameIPkey(email, ip);
    await this.redis.del(`failed_attempts:${usernameIPkey}`);
    await this.redis.del(`block:${usernameIPkey}`);
  }

  // Method to reset all login attempts for an email (admin function)
  async resetLoginAttemptsByEmail(email: string): Promise<void> {
    const pattern = `failed_attempts:${email}_*`;
    const keys = await this.redis.keys(pattern);

    if (keys.length > 0) {
      await this.redis.del(keys);
    }

    const blockPattern = `block:${email}_*`;
    const blockKeys = await this.redis.keys(blockPattern);
    if (blockKeys.length > 0) {
      await this.redis.del(blockKeys);
    }
  }

  // Method to unlock all rate limits for an email (admin function)
  async unlockAllRateLimitsByEmail(email: string): Promise<boolean> {
    const pattern = `rate_limit:*:${email}:*`;
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(keys);
    }
    return true;
  }
}
