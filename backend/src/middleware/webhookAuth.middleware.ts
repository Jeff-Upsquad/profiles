import { Request, Response, NextFunction } from 'express';
import { timingSafeEqual } from 'crypto';
import { env } from '../config/env.js';
import { AppError } from './errorHandler.middleware.js';

const SQUADHUB_HEADER = 'x-squadhub-signature';
const SQUADCRM_HEADER = 'x-squadcrm-signature';

/**
 * Verifies the X-SquadHub-Signature header against SQUADHUB_WEBHOOK_SECRET
 * using a constant-time compare. If the secret isn't configured at all we
 * respond 503 so SquadHub knows to retry later rather than silently accept.
 */
export function verifySquadhubSecret(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const expected = env.SQUADHUB_WEBHOOK_SECRET;
  if (!expected) {
    return next(new AppError(503, 'SquadHub webhook secret not configured'));
  }

  const provided = req.header(SQUADHUB_HEADER) ?? req.header('X-SquadHub-Signature');
  if (typeof provided !== 'string' || provided.length === 0) {
    return next(new AppError(401, 'Missing webhook signature'));
  }

  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return next(new AppError(401, 'Invalid webhook signature'));
  }

  next();
}

/**
 * Verifies X-SquadCRM-Signature against SQUADCRM_PROVISION_SECRET. The original
 * Squad CRM (crm.squadhub.in) calls POST /integrations/squadcrm/business/provision
 * when a deal enters its "Give SQUADHire Access" stage. A dedicated secret keeps
 * this distinct from the shcrm lead-stage secret below.
 */
export function verifySquadcrmProvisionSecret(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const expected = env.SQUADCRM_PROVISION_SECRET;
  if (!expected) {
    return next(new AppError(503, 'SquadCRM provision secret not configured'));
  }

  const provided = req.header(SQUADCRM_HEADER) ?? req.header('X-SquadCRM-Signature');
  if (typeof provided !== 'string' || provided.length === 0) {
    return next(new AppError(401, 'Missing webhook signature'));
  }

  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return next(new AppError(401, 'Invalid webhook signature'));
  }

  next();
}

/**
 * Verifies X-SquadCRM-Signature against SQUADCRM_INBOUND_SECRET. The SquadHire
 * CRM (shcrm) calls /webhooks/squadcrm/lead-stage when a card is moved between
 * pipeline stages so we can mirror the change onto lead_submissions.status.
 * Unset secret → 503 (so the CRM retries) rather than silently accepting.
 */
export function verifySquadcrmSecret(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const expected = env.SQUADCRM_INBOUND_SECRET;
  if (!expected) {
    return next(new AppError(503, 'SquadCRM webhook secret not configured'));
  }

  const provided = req.header(SQUADCRM_HEADER) ?? req.header('X-SquadCRM-Signature');
  if (typeof provided !== 'string' || provided.length === 0) {
    return next(new AppError(401, 'Missing webhook signature'));
  }

  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return next(new AppError(401, 'Invalid webhook signature'));
  }

  next();
}
