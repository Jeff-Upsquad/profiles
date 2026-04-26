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

export async function searchTalents(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q : '';
    const talents = await integrationsService.searchActiveTalents(q);
    res.json({ talents });
  } catch (err) {
    next(err);
  }
}
