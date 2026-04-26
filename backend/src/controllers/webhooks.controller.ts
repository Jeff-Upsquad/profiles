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

export async function removeTalentFromCard(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { externalId } = req.params as { externalId: string };
    const { talent_user_id } = req.body as { talent_user_id: string };
    const result = await subscriptionService.removeFromBusinessDashboard(
      externalId,
      talent_user_id
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
}
