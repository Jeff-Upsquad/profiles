import { Request, Response, NextFunction } from 'express';
import * as subscriptionService from '../services/subscription.service.js';

export async function ingestSubscriptionCard(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await subscriptionService.ingestCard(req.body);
    res.status(result.inserted ? 201 : 200).json(result);
  } catch (err) {
    next(err);
  }
}
