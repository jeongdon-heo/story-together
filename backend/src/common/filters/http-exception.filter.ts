import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let statusCode: number;
    let message: string;

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      message =
        typeof exceptionResponse === 'string'
          ? exceptionResponse
          : (exceptionResponse as any).message || exception.message;

      // class-validator 배열 메시지 처리
      if (Array.isArray(message)) {
        message = message.join(', ');
      }
    } else {
      statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Internal server error';
    }

    // 500+ 에러는 스택 트레이스 포함 로깅
    if (statusCode >= 500) {
      this.logger.error(
        `${request.method} ${request.url} ${statusCode} - ${message}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      this.logger.warn(
        `${request.method} ${request.url} ${statusCode} - ${message}`,
      );
    }

    response.status(statusCode).json({
      data: null,
      error: {
        statusCode,
        message,
        timestamp: new Date().toISOString(),
        path: request.url,
      },
    });
  }
}
