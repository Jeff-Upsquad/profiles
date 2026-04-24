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
      // Express 5 makes req.query / req.params getter-only, so we can't
      // reassign them. Mutate in place instead — Zod returns coerced values
      // and fills in defaults, and Object.assign copies those onto the
      // existing object that downstream handlers read from.
      if (schema.query) {
        const parsedQuery = schema.query.parse(req.query);
        Object.assign(req.query, parsedQuery);
      }
      if (schema.params) {
        const parsedParams = schema.params.parse(req.params);
        Object.assign(req.params, parsedParams);
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
