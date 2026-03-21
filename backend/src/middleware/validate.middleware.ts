import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { AppError } from './errorHandler.middleware.js';

/**
 * Generic Zod validation middleware.
 * Validates req.body, req.query, and/or req.params depending on what schemas are provided.
 */
export function validate(schema: {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (schema.body) {
        req.body = schema.body.parse(req.body);
      }
      if (schema.query) {
        req.query = schema.query.parse(req.query) as any;
      }
      if (schema.params) {
        req.params = schema.params.parse(req.params) as any;
      }
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const messages = err.errors.map(
          (e) => `${e.path.join('.')}: ${e.message}`
        );
        next(new AppError(400, `Validation failed: ${messages.join('; ')}`));
        return;
      }
      next(err);
    }
  };
}
