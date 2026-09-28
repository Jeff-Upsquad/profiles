import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AppError } from '../middleware/errorHandler.middleware.js';
import * as support from '../services/support-chat.service.js';

export async function supportChats(req: Request, res: Response, next: NextFunction) {
  try {
    const query = z.object({ status: z.enum(['all', 'handoff']).default('all'), page: z.coerce.number().int().min(0).max(10000).default(0) }).parse(req.query);
    res.json(await support.listSupportChats(query.status, query.page));
  } catch (e) { next(e instanceof z.ZodError ? new AppError(400, 'Invalid support chat query') : e); }
}
export async function supportChat(req: Request, res: Response, next: NextFunction) {
  try { res.json(await support.getSupportChat(z.string().uuid().parse(req.params.id), z.string().datetime().optional().parse(req.query.before)));  }
  catch (e) { next(e instanceof z.ZodError ? new AppError(400, 'Invalid chat ID') : e); }
}
export async function supportChatAction(req: Request, res: Response, next: NextFunction) {
  try {
    const id = z.string().uuid().parse(req.params.id);
    const action = z.enum(['reply', 'instruct', 'takeover', 'hand-back']).parse(req.params.action);
    // Identity is provided only by the authenticated CRM server, never its browser.
    const input = z.object({ actor: z.object({ id: z.string().uuid(), name: z.string().trim().min(1).max(200) }), body: z.string().trim().min(1).max(2000).optional() }).parse(req.body);
    if (['reply', 'instruct'].includes(action) && !input.body) throw new AppError(400, 'Write a message');
    res.json(await support.supportAction(id, action, input.actor, input.body));
  } catch (e) { next(e instanceof z.ZodError ? new AppError(400, 'Invalid support chat action') : e); }
}
