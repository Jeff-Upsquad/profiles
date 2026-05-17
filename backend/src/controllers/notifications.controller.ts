import { Request, Response, NextFunction } from 'express';
import * as svc from '../services/notifications.service.js';
import { AppError } from '../middleware/errorHandler.middleware.js';

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export async function listAdmin(_req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await svc.listAdminNotifications());
  } catch (e) { next(e); }
}

export async function previewAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await svc.previewRecipients(req.body.filters ?? {}));
  } catch (e) { next(e); }
}

export async function createAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user?.id) throw new AppError(401, 'Unauthenticated');
    const out = await svc.createBroadcast(req.body, req.user.id);
    res.status(201).json(out);
  } catch (e) { next(e); }
}

export async function deleteAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await svc.deleteNotification(req.params.id as string));
  } catch (e) { next(e); }
}

// ---------------------------------------------------------------------------
// Talent
// ---------------------------------------------------------------------------

export async function listTalent(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user?.id) throw new AppError(401, 'Unauthenticated');
    res.json({ notifications: await svc.listTalentNotifications(req.user.id) });
  } catch (e) { next(e); }
}

export async function markReadTalent(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user?.id) throw new AppError(401, 'Unauthenticated');
    res.json(await svc.markRead(req.params.id as string, req.user.id));
  } catch (e) { next(e); }
}

export async function markAllReadTalent(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user?.id) throw new AppError(401, 'Unauthenticated');
    res.json(await svc.markAllRead(req.user.id));
  } catch (e) { next(e); }
}

export async function unreadCountTalent(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user?.id) throw new AppError(401, 'Unauthenticated');
    res.json(await svc.getUnreadCount(req.user.id));
  } catch (e) { next(e); }
}
