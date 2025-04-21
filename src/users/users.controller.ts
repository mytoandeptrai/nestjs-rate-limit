import { Controller, Post, Body, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { RateLimitGuard, RateLimit } from '../rate-limit/rate-limit.guard';
import { Request } from 'express';

interface SignInBody {
  email: string;
  password: string;
}

interface SignUpBody {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

interface ForgotPasswordBody {
  email: string;
}

interface ResetRateLimitBody {
  email: string;
  ip?: string;
}

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('signin')
  @ApiOperation({ summary: 'User sign in' })
  @ApiResponse({
    status: 200,
    description: 'User successfully signed in',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        data: {
          type: 'object',
          properties: {
            token: { type: 'string' },
            user: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                email: { type: 'string' },
              },
            },
          },
        },
      },
    },
  })
  async signIn(@Body() body: SignInBody, @Req() req: Request) {
    const forwardedFor = req.headers['x-forwarded-for'];
    const ip = Array.isArray(forwardedFor)
      ? forwardedFor[0]
      : forwardedFor || req.ip || req.socket.remoteAddress || '127.0.0.1';
    console.log('🚀 ~ signIn ~ ip:', ip);
    console.log('🚀 ~ signIn ~ forwardedFor:', forwardedFor);
    console.log('🚀 ~ signIn ~ req.ip:', req.ip);
    console.log(
      '🚀 ~ signIn ~ req.socket.remoteAddress:',
      req.socket.remoteAddress,
    );
    return this.usersService.signIn(body.email, body.password, ip);
  }

  @Post('signup')
  @ApiOperation({ summary: 'User registration' })
  @ApiResponse({
    status: 201,
    description: 'User successfully registered',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        data: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            email: { type: 'string' },
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
  })
  async signUp(@Body() body: SignUpBody) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          success: true,
          message: 'User registered successfully',
          data: {
            id: 'mock-user-id',
            email: body.email,
            firstName: body.firstName,
            lastName: body.lastName,
            createdAt: new Date().toISOString(),
          },
        });
      }, 1000);
    });
  }

  @UseGuards(RateLimitGuard)
  @RateLimit('forgot-password')
  @Post('forgot-password')
  @ApiOperation({ summary: 'Request password reset' })
  @ApiResponse({
    status: 200,
    description: 'Password reset email sent successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        data: {
          type: 'object',
          properties: {
            email: { type: 'string' },
            resetToken: { type: 'string' },
            expiresIn: { type: 'number' },
          },
        },
      },
    },
  })
  async forgotPassword(@Body() body: ForgotPasswordBody) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          success: true,
          message: 'Password reset email sent successfully',
          data: {
            email: body.email,
            resetToken: 'mock-reset-token',
            expiresIn: 3600, // 1 hour
          },
        });
      }, 1000);
    });
  }

  @Post('reset-rate-limit')
  @ApiOperation({ summary: 'Reset rate limit for specific email and IP' })
  @ApiResponse({
    status: 200,
    description: 'Rate limit reset successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
      },
    },
  })
  async resetRateLimit(@Body() body: ResetRateLimitBody, @Req() req: Request) {
    const ip = body.ip || req.ip || '127.0.0.1';
    await this.usersService.resetRateLimit(body.email, ip);
    return {
      success: true,
      message: 'Rate limit reset successfully',
    };
  }

  @Post('reset-all-rate-limits')
  @ApiOperation({
    summary: 'Reset all rate limits for an email (Admin function)',
  })
  @ApiResponse({
    status: 200,
    description: 'All rate limits reset successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
      },
    },
  })
  async resetAllRateLimits(@Body() body: ResetRateLimitBody) {
    await this.usersService.resetAllRateLimits(body.email);
    return {
      success: true,
      message: 'All rate limits reset successfully',
    };
  }
}
