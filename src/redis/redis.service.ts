import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, RedisClientType } from 'redis';

@Injectable()
export class RedisService implements OnModuleInit {
  private redis: RedisClientType;
  private isConnected = false;

  constructor(private configService: ConfigService) {
    this.redis = createClient({
      url: this.configService.get('REDIS_URI') || 'redis://localhost:6379',
    });

    this.redis.on('connect', () => {
      console.log('Redis connected successfully');
      this.isConnected = true;
    });

    this.redis.on('error', (err) => {
      console.error('Redis connection error:', err);
      this.isConnected = false;
    });

    this.redis.on('reconnecting', () => {
      console.log('Redis reconnecting...');
      this.isConnected = false;
    });

    this.redis.connect();
  }

  async onModuleInit() {
    try {
      await this.redis.ping();
      console.log('Redis ping successful');
      this.isConnected = true;
    } catch (error) {
      console.error('Redis ping failed:', error);
      this.isConnected = false;
    }
  }

  isRedisConnected(): boolean {
    return this.isConnected;
  }

  async get(key: string): Promise<string | null> {
    return this.redis.get(key);
  }

  async set(
    key: string,
    value: string,
    options?: { EX?: number },
  ): Promise<void> {
    await this.redis.set(key, value, options);
  }

  async del(key: string): Promise<void> {
    await this.redis.del(key);
  }

  async hGetAll(key: string): Promise<Record<string, string>> {
    return this.redis.hGetAll(key);
  }

  async hSet(key: string, field: string, value: string): Promise<void> {
    await this.redis.hSet(key, field, value);
  }

  async ttl(key: string): Promise<number> {
    return this.redis.ttl(key);
  }

  async incr(key: string): Promise<number> {
    return this.redis.incr(key);
  }

  async keys(pattern: string): Promise<string[]> {
    return this.redis.keys(pattern);
  }
}
