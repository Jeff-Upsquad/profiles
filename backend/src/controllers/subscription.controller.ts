import { Request, Response, NextFunction } from 'express';
import * as subscriptionService from '../services/subscription.service.js';
import { AppError } from '../middleware/errorHandler.middleware.js';

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');
    const cards = await subscriptionService.listForTalent(
      req.user.id,
      req.query as { status: 'pending' | 'accepted' | 'rejected' | 'all' }
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
    const distribution = typeof req.query.distribution === 'string' && (req.query.distribution === 'broadcast' || req.query.distribution === 'manual')
      ? req.query.distribution
      : undefined;
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const bizFilter = typeof req.query.business_review === 'string'
      && ['has_shortlisted', 'has_business_rejected', 'has_selected'].includes(req.query.business_review)
      ? req.query.business_review as 'has_shortlisted' | 'has_business_rejected' | 'has_selected'
      : undefined;
    const items = await subscriptionService.listAllForAdmin({ status, distribution, search, business_review_filter: bizFilter });
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

export async function adminGetCard(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const card = await subscriptionService.getCardForAdmin(req.params.id as string);
    res.json(card);
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

export async function adminRemoveFromBusinessDashboard(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { cardId, recipientId } = req.params as { cardId: string; recipientId: string };
    const result = await subscriptionService.removeFromBusinessDashboardByRecipient(
      cardId,
      recipientId
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function adminSelectRecipient(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { cardId } = req.params as { cardId: string };
    const { recipient_id } = req.body as { recipient_id: string };
    const result = await subscriptionService.adminSelectRecipient(cardId, recipient_id);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function adminUndoSelection(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { cardId } = req.params as { cardId: string };
    await subscriptionService.adminUndoSelection(cardId);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

export async function myClients(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');
    const data = await subscriptionService.listMyClients(req.user.id);
    res.json(data);
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
