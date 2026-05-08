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
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_SERVER_ERROR';
    let message = 'Internal server error';
    let details: unknown = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'string') {
        code = res;
        message = this.humanize(res, status);
      } else if (typeof res === 'object' && res !== null) {
        const resObj = res as Record<string, unknown>;
        // ValidationPipe returns { message: string[], error: string }
        const rawMessage = resObj['message'];
        if (Array.isArray(rawMessage)) {
          code = 'VALIDATION_ERROR';
          message = 'Validation failed';
          details = rawMessage;
        } else {
          code = (resObj['code'] as string) ?? (rawMessage as string) ?? code;
          message = this.humanize(code, status);
          details = resObj['details'];
        }
      }
    } else if (exception instanceof Error) {
      this.logger.error(exception.message, exception.stack);
    }

    // Never leak stack traces or internal messages in production
    const isProduction = process.env.NODE_ENV === 'production';
    if (isProduction && status === HttpStatus.INTERNAL_SERVER_ERROR) {
      message = 'Internal server error';
    }

    response.status(status).json({
      success: false,
      error: {
        code,
        message,
        details: details ?? undefined,
      },
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }

  private humanize(code: string, status: number): string {
    const map: Record<string, string> = {
      AUTH_INVALID_OTP: 'Invalid OTP code',
      AUTH_OTP_EXPIRED: 'OTP code has expired',
      AUTH_OTP_MAX_ATTEMPTS: 'Too many failed OTP attempts',
      AUTH_INVALID_CREDENTIALS: 'Invalid email or password',
      AUTH_TOKEN_EXPIRED: 'Token has expired',
      AUTH_TOKEN_REVOKED: 'Token has been revoked',
      AUTH_USER_NOT_FOUND: 'User not found',
      USER_SUSPENDED: 'Account is suspended or banned',
      RESOURCE_NOT_FOUND: 'Requested resource was not found',
      RESTAURANT_CLOSED: 'Restaurant is not accepting orders',
      CART_EMPTY: 'Cart must have at least one item',
      PRODUCT_UNAVAILABLE: 'One or more products are unavailable',
      MIN_ORDER_NOT_MET: 'Order does not meet minimum order amount',
      ORDER_INVALID_STATUS: 'Invalid order status transition',
      DELIVERY_ALREADY_ASSIGNED: 'Delivery already assigned to another driver',
      OFFER_EXPIRED: 'Delivery offer has expired',
      DRIVER_ALREADY_ON_DELIVERY: 'Driver already has an active delivery',
      OFFER_NOT_FOUND: 'Delivery offer not found',
      INSUFFICIENT_PERMISSIONS:
        'You do not have permission to perform this action',
      FORBIDDEN_ROLE: 'Access denied for this resource',
      VALIDATION_ERROR: 'Request validation failed',
      RATE_LIMIT_EXCEEDED: 'Too many requests — please slow down',
    };
    return (
      map[code] ??
      (status === 404
        ? 'Resource not found'
        : status === 403
          ? 'Forbidden'
          : status === 401
            ? 'Unauthorized'
            : code)
    );
  }
}
