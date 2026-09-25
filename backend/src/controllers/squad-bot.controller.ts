import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AppError } from '../middleware/errorHandler.middleware.js';

// Squad Bot — talent help chat (talent side) and the admin Squad Bot Inbox.

const messageSchema = z.object({ body: z.string().trim().min(1).max(2000) });

function parseBody(req: Request): string {
  const parsed = messageSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, 'Write a message of up to 2,000 characters');
  return parsed.data.body;
}

/** Who is replying: a staff user's name, else the admin's email name. */
function actor(req: Request): { id: string; name: string } {
  if (req.staff) return { id: req.staff.id, name: req.staff.name || req.staff.email };
  const email = req.user?.email ?? 'admin';
  return { id: req.user!.id, name: email.split('@')[0] };
}

// --- Talent -----------------------------------------------------------------

export async function getMyChat(req: Request, res: Response, next: NextFunction) {
  try {
    const svc = await import('../services/squad-bot.service.js');
    res.json(await svc.getTalentChat(req.user!.id));
  } catch (err) {
    next(err);
  }
}

export async function sendMyMessage(req: Request, res: Response, next: NextFunction) {
  try {
    const svc = await import('../services/squad-bot.service.js');
    res.json(await svc.sendTalentMessage(req.user!.id, parseBody(req)));
  } catch (err) {
    next(err);
  }
}

// --- Admin inbox ------------------------------------------------------------

export async function listConversations(req: Request, res: Response, next: NextFunction) {
  try {
    const svc = await import('../services/squad-bot.service.js');
    const status = req.query.status === 'all' ? 'all' : 'handoff';
    const [conversations, waiting] = await Promise.all([svc.listConversations(status), svc.handoffCount()]);
    res.json({ conversations, waiting });
  } catch (err) {
    next(err);
  }
}

export async function getConversation(req: Request, res: Response, next: NextFunction) {
  try {
    const svc = await import('../services/squad-bot.service.js');
    res.json(await svc.getConversation(req.params.id as string));
  } catch (err) {
    next(err);
  }
}

export async function reply(req: Request, res: Response, next: NextFunction) {
  try {
    const svc = await import('../services/squad-bot.service.js');
    res.json(await svc.staffReply(req.params.id as string, actor(req), parseBody(req)));
  } catch (err) {
    next(err);
  }
}

export async function handBack(req: Request, res: Response, next: NextFunction) {
  try {
    const svc = await import('../services/squad-bot.service.js');
    res.json(await svc.handBack(req.params.id as string, actor(req)));
  } catch (err) {
    next(err);
  }
}
