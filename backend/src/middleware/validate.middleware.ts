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
      // Express 5 implements req.query / req.params as getters that don't
      // persist mutations from Object.assign — so Zod-applied defaults and
      // coercions get silently dropped. Replace the getter with a plain
      // property using Object.defineProperty so the parsed value (with
      // defaults applied) is what downstream handlers see.
      if (schema.query) {
        const parsedQuery = schema.query.parse(req.query);
        Object.defineProperty(req, 'query', {
          value: parsedQuery,
          writable: true,
          configurable: true,
          enumerable: true,
        });
      }
      if (schema.params) {
        const parsedParams = schema.params.parse(req.params);
        Object.defineProperty(req, 'params', {
          value: parsedParams,
          writable: true,
          configurable: true,
          enumerable: true,
        });
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
