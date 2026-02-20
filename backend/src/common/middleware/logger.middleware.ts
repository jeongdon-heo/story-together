import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction) {
    // /health/live는 노이즈 방지를 위해 스킵
    if (req.originalUrl === '/health/live') {
      return next();
    }

    const start = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - start;
      const { method } = req;
      const url = req.originalUrl;
      const { statusCode } = res;

      this.logger.log(`${method} ${url} ${statusCode} ${duration}ms`);
    });

    next();
  }
}
