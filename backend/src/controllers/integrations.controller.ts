import { Request, Response, NextFunction } from 'express';
import * as integrationsService from '../services/integrations.service.js';

export async function getCategories(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const categories = await integrationsService.listActiveCategories();
    res.json({ categories });
  } catch (err) {
    next(err);
  }
}
