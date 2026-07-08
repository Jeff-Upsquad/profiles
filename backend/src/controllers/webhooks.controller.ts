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

export async function handleTalentAccepted(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { card_id, talent_id, accepted_at } = req.body;
    const result = await subscriptionService.handleTalentAcceptedByWebhook(
      card_id,
      talent_id,
      accepted_at,
    );
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function manualAssignTalent(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await subscriptionService.manualAssignTalent(req.body);
    res.status(result.inserted ? 201 : 200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function handleCardSelection(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { card_id, talent_id, talent_ids, selected_at, card_status } = req.body;
    const resolvedTalentIds: string[] = Array.isArray(talent_ids) && talent_ids.length > 0
      ? talent_ids
      : (talent_id ? [talent_id] : []);
    await subscriptionService.handleSelectionWebhook(card_id, resolvedTalentIds, selected_at, card_status ?? null);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

export async function handleCardSelectionUndo(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { card_id } = req.body;
    await subscriptionService.handleSelectionUndoWebhook(card_id);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

export async function handleCardActivation(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { card_id, activated_at } = req.body;
    await subscriptionService.handleActivationWebhook(card_id, activated_at);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

export async function handleFreshBroadcast(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { card_id } = req.body;
    const result = await subscriptionService.freshBroadcast(card_id);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function removeAssignedTalent(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await subscriptionService.removeAssignedTalent(req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * Returns the full talent recipient list for a card by SquadHub external_id.
 * Used by SquadHub admin to show who the card was broadcasted to.
 */
export async function getCardRecipients(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { external_id } = req.body as { external_id: string };
    const recipients = await subscriptionService.listRecipientsByExternalId(external_id);
    res.json({ data: recipients });
  } catch (err) {
    next(err);
  }
}

/**
 * Read-only preview of the talents a card's match_rules would reach. Runs the
 * matcher without ingesting the card or writing/notifying anyone. Used by
 * SquadHub to show the audience on a published (not-yet-broadcast) card.
 */
export async function previewCardRecipients(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { match_rules, card_type } = req.body as {
      match_rules: Record<string, unknown>;
      card_type?: 'subscription' | 'assignment' | 'hiring';
    };
    const preview = await subscriptionService.previewRecipientsByRules(
      match_rules ?? {},
      card_type ?? 'subscription',
    );
    res.json({ data: preview.talents, count: preview.count });
  } catch (err) {
    next(err);
  }
}
