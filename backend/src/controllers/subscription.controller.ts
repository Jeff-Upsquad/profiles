import { Request, Response, NextFunction } from 'express';
import * as subscriptionService from '../services/subscription.service.js';
import { AppError } from '../middleware/errorHandler.middleware.js';

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');
    const cards = await subscriptionService.listForTalent(
      req.user.id,
      req.query as { status: 'pending' | 'responded' | 'all' }
    );
    res.json({ items: cards });
  } catch (err) {
    next(err);
  }
}

export async function unreadCount(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');
    const count = await subscriptionService.getUnreadCount(req.user.id);
    res.json({ count });
  } catch (err) {
    next(err);
  }
}

export async function adminListCards(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const status = typeof req.query.status === 'string' && (req.query.status === 'active' || req.query.status === 'archived')
      ? req.query.status
      : undefined;
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const items = await subscriptionService.listAllForAdmin({ status, search });
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

export async function adminListRecipients(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const items = await subscriptionService.listRecipientsForAdmin(req.params.id as string);
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

export async function respond(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');
    const result = await subscriptionService.respond(
      req.user.id,
      req.params.recipientId as string,
      req.body
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
}
