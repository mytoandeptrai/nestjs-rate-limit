import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { RateLimitService } from '../rate-limit/rate-limit.service';

@Injectable()
export class UsersService {
  private mockUsers = [
    { email: 'user1@test.com', password: 'password1', isActive: true },
    { email: 'user2@test.com', password: 'password2', isActive: true },
  ];
  private readonly failedAttemptsPerBlock = 3;
  private readonly blockPeriods = [
    10, // 10 seconds
    60, // 1 minute
    600, // 10 minutes
    1800, // 30 minutes
    3600, // 1 hour
    10800, // 3 hours
    32400, // 9 hours
    43200, // 12 hours
    86400, // 24 hours
    172800, // 48 hours
    432000, // 5 days
    864000, // 10 days
  ];

  constructor(private readonly rateLimitService: RateLimitService) {}

  async signIn(email: string, password: string, ip: string) {
    // Check rate limits
    const { retrySecs, blockDuration } =
      await this.rateLimitService.checkLoginAttempts(
        email,
        ip,
        this.failedAttemptsPerBlock,
        this.blockPeriods,
      );

    if (retrySecs > 0) {
      throw new HttpException(
        {
          message: 'Too many login attempts',
          data: {
            retryAfter: retrySecs,
            blockDuration: blockDuration,
          },
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Find user
    const user = this.mockUsers.find(
      (u) => u.email === email && u.password === password,
    );

    if (!user) {
      await this.rateLimitService.handleFailedLogin(
        email,
        ip,
        this.failedAttemptsPerBlock,
        this.blockPeriods,
      );
      throw new HttpException('Invalid credentials', HttpStatus.UNAUTHORIZED);
    }

    if (!user.isActive) {
      await this.rateLimitService.handleFailedLogin(
        email,
        ip,
        this.failedAttemptsPerBlock,
        this.blockPeriods,
      );
      throw new HttpException('User is not active', HttpStatus.UNAUTHORIZED);
    }

    // Reset failed attempts on successful login
    await this.rateLimitService.resetLoginAttempts(email, ip);

    return {
      accessToken: 'mock_access_token',
      refreshToken: 'mock_refresh_token',
      user: {
        email: user.email,
        isActive: user.isActive,
      },
    };
  }

  async resetRateLimit(email: string, ip: string): Promise<void> {
    await this.rateLimitService.resetLoginAttempts(email, ip);
  }

  async resetAllRateLimits(email: string): Promise<void> {
    await this.rateLimitService.unlockAllRateLimitsByEmail(email);
  }
}
