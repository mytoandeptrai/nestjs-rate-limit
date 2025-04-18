# Rate Limit Service

A NestJS service that implements rate limiting using Redis.

## Features

- Rate limiting for API endpoints
- Redis-based storage for rate limit data
- Health check endpoint for Redis connection
- Swagger API documentation
- Mock user authentication endpoints

## Prerequisites

- Node.js (v14 or later)
- Redis server
- npm or yarn

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd nestjs-rate-limit
```

2. Install dependencies:
```bash
npm install
```

3. Install additional required packages:
```bash
npm install @nestjs/swagger swagger-ui-express
```

4. Create a `.env` file in the root directory with the following content:
```
REDIS_URI=redis://localhost:6379
PORT=3000
```

## Running the Application

1. Start Redis server:
```bash
redis-server
```

2. Start the application:
```bash
npm run start:dev
```

The application will be available at `http://localhost:3000`

## API Documentation

Swagger documentation is available at `http://localhost:3000/api`

## API Endpoints

### Health Check
- `GET /health/redis` - Check Redis connection status

### User Authentication
- `POST /users/signin` - User sign in
- `POST /users/signup` - User registration
- `POST /users/forgot-password` - Request password reset (rate limited)

## Rate Limiting

The service implements rate limiting using Redis with the following features:
- Configurable request limits
- Time-based window for rate limiting
- IP-based rate limiting
- Email-based rate limiting for specific endpoints

## Development

### Project Structure
```
src/
├── app.controller.ts
├── app.module.ts
├── app.service.ts
├── main.ts
├── redis/
│   ├── redis.module.ts
│   └── redis.service.ts
├── rate-limit/
│   ├── rate-limit.guard.ts
│   └── rate-limit.service.ts
└── users/
    ├── users.controller.ts
    └── users.service.ts
```

### Environment Variables
- `REDIS_URI`: Redis connection URI (default: redis://localhost:6379)
- `PORT`: Application port (default: 3000)

## License

MIT
