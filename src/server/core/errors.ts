import type { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { ZodError } from 'zod';

export class AppError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly type: string;
  public readonly details?: unknown;

  constructor(options: {
    status: number;
    code: string;
    message: string;
    type?: string;
    details?: unknown;
  }) {
    super(options.message);
    this.status = options.status;
    this.code = options.code;
    this.type = options.type || `https://ufuq.commerce/errors/${options.code.toLowerCase()}`;
    this.details = options.details;
  }
}

export function problemDetailsHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const traceId = (req.headers['x-request-id'] as string) || `req_${crypto.randomBytes(6).toString('hex')}`;
  const isProd = process.env.NODE_ENV === 'production';

  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      type: 'https://ufuq.commerce/errors/validation_error',
      title: 'Invalid request data',
      status: 400,
      code: 'VALIDATION_ERROR',
      detail: 'One or more request fields are invalid.',
      details: err.flatten(),
      instance: req.originalUrl,
      traceId,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.status).json({
      success: false,
      type: err.type,
      title: err.message,
      status: err.status,
      code: err.code,
      detail: err.message,
      details: err.details ?? null,
      instance: req.originalUrl,
      traceId,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  const message = err instanceof Error ? err.message : 'Internal server error';
  res.status(500).json({
    success: false,
    type: 'https://ufuq.commerce/errors/internal_server_error',
    title: isProd ? 'An unexpected server error occurred' : message,
    status: 500,
    code: 'INTERNAL_SERVER_ERROR',
    detail: isProd ? 'Please contact support with traceId.' : message,
    instance: req.originalUrl,
    traceId,
    timestamp: new Date().toISOString(),
  });
}
