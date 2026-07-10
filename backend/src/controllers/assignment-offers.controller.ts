import { Request, Response, NextFunction } from 'express';
import * as offers from '../services/assignment-offers.service.js';
import { AppError } from '../middleware/errorHandler.middleware.js';

// ─── Talent (mounted under /api/talent/subscriptions) ──────────────────────

export async function talentGetOffer(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');
    const data = await offers.getOfferForTalentRecipient(req.user.id, req.params.recipientId as string);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function talentSubmitOffer(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');
    const offer = await offers.talentSubmitOrCounter(req.user.id, req.params.recipientId as string, req.body);
    res.json({ offer });
  } catch (err) {
    next(err);
  }
}

export async function talentRespond(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');
    const offer = await offers.talentRespondToOffer(req.user.id, req.params.recipientId as string, req.body);
    res.json({ offer });
  } catch (err) {
    next(err);
  }
}

// ─── Business (mounted under /api/business/my-assignment-cards) ─────────────

export async function businessListOffers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');
    const list = await offers.listOffersForBusinessCard(req.user.id, req.params.cardId as string);
    res.json({ offers: list });
  } catch (err) {
    next(err);
  }
}

export async function businessCounter(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');
    const offer = await offers.businessCounterOffer(
      req.user.id,
      req.params.cardId as string,
      req.params.offerId as string,
      req.body,
    );
    res.json({ offer });
  } catch (err) {
    next(err);
  }
}

export async function businessAccept(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');
    const offer = await offers.businessAcceptOffer(
      req.user.id,
      req.params.cardId as string,
      req.params.offerId as string,
      req.body,
    );
    res.json({ offer });
  } catch (err) {
    next(err);
  }
}

export async function businessDecline(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');
    const offer = await offers.businessDeclineOffer(
      req.user.id,
      req.params.cardId as string,
      req.params.offerId as string,
      req.body,
    );
    res.json({ offer });
  } catch (err) {
    next(err);
  }
}

// ─── SquadHub webhooks (verifySquadhubSecret, no req.user) ──────────────────

/** Read-only: the live offers snapshot for one card, for SquadHub's admin view. */
export async function handleOffersSnapshot(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const snapshot = await offers.getCardOffersSnapshotByExternalId(req.body.external_id);
    res.json({ snapshot });
  } catch (err) {
    next(err);
  }
}

/** SquadHub admin drives a business-side transition (counter/accept/decline). */
export async function handleAdminOffers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const offer = await offers.adminOfferAction(req.body);
    res.json({ offer });
  } catch (err) {
    next(err);
  }
}
