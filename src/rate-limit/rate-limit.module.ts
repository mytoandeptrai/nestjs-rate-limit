import { Module } from '@nestjs/common';
import { RateLimitService } from './rate-limit.service';
import { RateLimitController } from './rate-limit.controller';

@Module({
  providers: [RateLimitService],
  controllers: [RateLimitController],
  exports: [RateLimitService],
})
export class RateLimitModule {}
