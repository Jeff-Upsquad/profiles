import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { whatsappConversation } from '../services/squad-bot.service.js';
import { currentChatBotSwitch, setChatBotSwitch } from '../services/chat-bot-switch.service.js';
export async function chatBotSwitch(req: Request, res: Response, next: NextFunction) {
  try {
    const body = z.object({ lead_id: z.string().uuid(), phone: z.string().min(1), name: z.string().max(120),
      pipeline_name: z.string().max(200), enabled: z.boolean().optional(),
      actor: z.object({ id: z.string().uuid().nullable(), name: z.string().min(1).max(120) }) }).parse(req.body);
    const conv = await whatsappConversation({ ...body, text: '', message_id: 'bot-control' });
    res.json(body.enabled === undefined ? { enabled: await currentChatBotSwitch(conv) } : await setChatBotSwitch(conv, body.enabled, body.actor));
  } catch (error) { next(error); }
}
