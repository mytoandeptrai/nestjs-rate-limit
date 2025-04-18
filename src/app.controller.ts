import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';
import { RedisService } from './redis/redis.service';

@ApiTags('health')
@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly redisService: RedisService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health/redis')
  @ApiOperation({ summary: 'Check Redis connection status' })
  @ApiResponse({
    status: 200,
    description: 'Returns Redis connection status',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['connected', 'disconnected'] },
        timestamp: { type: 'string', format: 'date-time' },
      },
    },
  })
  checkRedisHealth() {
    const isConnected = this.redisService.isRedisConnected();
    return {
      status: isConnected ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString(),
    };
  }
}
