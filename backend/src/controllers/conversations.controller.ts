import { Request, Response, NextFunction } from 'express';
import * as conversations from '../services/conversations.service.js';
import type { ConversationActor } from '../services/conversations.service.js';

function businessActor(req: Request): ConversationActor {
  return { type: 'business', id: req.user!.id };
}

function talentActor(req: Request): ConversationActor {
  return { type: 'talent', id: req.user!.id };
}

function adminActor(req: Request): ConversationActor {
  if (req.staff) {
    return {
      type: 'staff',
      id: req.staff.id,
      name: req.staff.name,
      email: req.staff.email,
      grants: req.staff.grants,
    };
  }
  return { type: 'admin', id: req.user!.id, email: req.user!.email };
}

// ─── Business ───────────────────────────────────────────────────────────────

export async function businessCreate(req: Request, res: Response, next: NextFunction) {
  try {
    const conversation = await conversations.createOrGetConversation(businessActor(req), {
      cardId: req.body.cardId,
      talentUserId: req.body.talentUserId,
    });
    res.status(201).json({ conversation });
  } catch (err) {
    next(err);
  }
}

export async function businessList(req: Request, res: Response, next: NextFunction) {
  try {
    const list = await conversations.listConversations(businessActor(req));
    res.json({ conversations: list });
  } catch (err) {
    next(err);
  }
}

export async function businessUnread(req: Request, res: Response, next: NextFunction) {
  try {
    const unread = await conversations.getUnreadTotal(businessActor(req));
    res.json({ unread });
  } catch (err) {
    next(err);
  }
}

export async function businessGet(req: Request, res: Response, next: NextFunction) {
  try {
    const conversation = await conversations.getConversation(businessActor(req), req.params.id as string);
    await conversations.markRead(businessActor(req), req.params.id as string);
    res.json({ conversation });
  } catch (err) {
    next(err);
  }
}

export async function businessMessages(req: Request, res: Response, next: NextFunction) {
  try {
    const messages = await conversations.listMessages(businessActor(req), req.params.id as string, {
      after: typeof req.query.after === 'string' ? req.query.after : undefined,
      limit: Number(req.query.limit) || 50,
    });
    res.json({ messages });
  } catch (err) {
    next(err);
  }
}

export async function businessSend(req: Request, res: Response, next: NextFunction) {
  try {
    const message = await conversations.sendMessage(
      businessActor(req),
      req.params.id as string,
      req.body.body,
    );
    res.status(201).json({ message });
  } catch (err) {
    next(err);
  }
}

export async function businessProposeMeeting(req: Request, res: Response, next: NextFunction) {
  try {
    const message = await conversations.proposeMeeting(businessActor(req), req.params.id as string, req.body);
    res.status(201).json({ message });
  } catch (err) {
    next(err);
  }
}

export async function businessRespondMeeting(req: Request, res: Response, next: NextFunction) {
  try {
    const meeting = await conversations.respondToMeeting(
      businessActor(req),
      req.params.id as string,
      req.params.meetingId as string,
      req.body.action,
    );
    res.json({ meeting });
  } catch (err) {
    next(err);
  }
}

export async function businessCancelMeeting(req: Request, res: Response, next: NextFunction) {
  try {
    const meeting = await conversations.cancelMeeting(
      businessActor(req),
      req.params.id as string,
      req.params.meetingId as string,
    );
    res.json({ meeting });
  } catch (err) {
    next(err);
  }
}

// ─── Talent ─────────────────────────────────────────────────────────────────

export async function talentList(req: Request, res: Response, next: NextFunction) {
  try {
    const list = await conversations.listConversations(talentActor(req));
    res.json({ conversations: list });
  } catch (err) {
    next(err);
  }
}

export async function talentUnread(req: Request, res: Response, next: NextFunction) {
  try {
    const unread = await conversations.getUnreadTotal(talentActor(req));
    res.json({ unread });
  } catch (err) {
    next(err);
  }
}

export async function talentGet(req: Request, res: Response, next: NextFunction) {
  try {
    const conversation = await conversations.getConversation(talentActor(req), req.params.id as string);
    await conversations.markRead(talentActor(req), req.params.id as string);
    res.json({ conversation });
  } catch (err) {
    next(err);
  }
}

export async function talentMessages(req: Request, res: Response, next: NextFunction) {
  try {
    const messages = await conversations.listMessages(talentActor(req), req.params.id as string, {
      after: typeof req.query.after === 'string' ? req.query.after : undefined,
      limit: Number(req.query.limit) || 50,
    });
    res.json({ messages });
  } catch (err) {
    next(err);
  }
}

export async function talentSend(req: Request, res: Response, next: NextFunction) {
  try {
    const message = await conversations.sendMessage(
      talentActor(req),
      req.params.id as string,
      req.body.body,
    );
    res.status(201).json({ message });
  } catch (err) {
    next(err);
  }
}

export async function talentProposeMeeting(req: Request, res: Response, next: NextFunction) {
  try {
    const message = await conversations.proposeMeeting(talentActor(req), req.params.id as string, req.body);
    res.status(201).json({ message });
  } catch (err) {
    next(err);
  }
}

export async function talentRespondMeeting(req: Request, res: Response, next: NextFunction) {
  try {
    const meeting = await conversations.respondToMeeting(
      talentActor(req),
      req.params.id as string,
      req.params.meetingId as string,
      req.body.action,
    );
    res.json({ meeting });
  } catch (err) {
    next(err);
  }
}

export async function talentCancelMeeting(req: Request, res: Response, next: NextFunction) {
  try {
    const meeting = await conversations.cancelMeeting(
      talentActor(req),
      req.params.id as string,
      req.params.meetingId as string,
    );
    res.json({ meeting });
  } catch (err) {
    next(err);
  }
}

// ─── Admin / staff ──────────────────────────────────────────────────────────

export async function adminList(req: Request, res: Response, next: NextFunction) {
  try {
    const list = await conversations.listConversations(adminActor(req), {
      status: req.query.status as any,
      business_user_id: req.query.business_user_id as string | undefined,
      talent_user_id: req.query.talent_user_id as string | undefined,
      salesperson_id: req.query.salesperson_id as string | undefined,
      card_id: req.query.card_id as string | undefined,
    });
    res.json({ conversations: list });
  } catch (err) {
    next(err);
  }
}

export async function adminCreate(req: Request, res: Response, next: NextFunction) {
  try {
    const conversation = await conversations.createOrGetConversation(adminActor(req), {
      cardId: req.body.cardId,
      talentUserId: req.body.talentUserId,
    });
    res.status(201).json({ conversation });
  } catch (err) {
    next(err);
  }
}

export async function adminGet(req: Request, res: Response, next: NextFunction) {
  try {
    const conversation = await conversations.getConversation(adminActor(req), req.params.id as string);
    await conversations.markRead(adminActor(req), req.params.id as string);
    res.json({ conversation });
  } catch (err) {
    next(err);
  }
}

export async function adminMessages(req: Request, res: Response, next: NextFunction) {
  try {
    const messages = await conversations.listMessages(adminActor(req), req.params.id as string, {
      after: typeof req.query.after === 'string' ? req.query.after : undefined,
      limit: Number(req.query.limit) || 50,
    });
    res.json({ messages });
  } catch (err) {
    next(err);
  }
}

export async function adminSend(req: Request, res: Response, next: NextFunction) {
  try {
    const message = await conversations.sendMessage(adminActor(req), req.params.id as string, req.body.body);
    res.status(201).json({ message });
  } catch (err) {
    next(err);
  }
}

export async function adminAssign(req: Request, res: Response, next: NextFunction) {
  try {
    const conversation = await conversations.assignSalesperson(
      adminActor(req),
      req.params.id as string,
      req.body.staff_user_id,
    );
    res.json({ conversation });
  } catch (err) {
    next(err);
  }
}

export async function adminClose(req: Request, res: Response, next: NextFunction) {
  try {
    const conversation = await conversations.closeConversation(adminActor(req), req.params.id as string);
    res.json({ conversation });
  } catch (err) {
    next(err);
  }
}

export async function adminReopen(req: Request, res: Response, next: NextFunction) {
  try {
    const conversation = await conversations.reopenConversation(adminActor(req), req.params.id as string);
    res.json({ conversation });
  } catch (err) {
    next(err);
  }
}

export async function adminDeleteMessage(req: Request, res: Response, next: NextFunction) {
  try {
    await conversations.softDeleteMessage(
      adminActor(req),
      req.params.id as string,
      req.params.messageId as string,
    );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

export async function adminProposeMeeting(req: Request, res: Response, next: NextFunction) {
  try {
    const message = await conversations.proposeMeeting(adminActor(req), req.params.id as string, req.body);
    res.status(201).json({ message });
  } catch (err) {
    next(err);
  }
}

export async function adminRespondMeeting(req: Request, res: Response, next: NextFunction) {
  try {
    const meeting = await conversations.respondToMeeting(
      adminActor(req),
      req.params.id as string,
      req.params.meetingId as string,
      req.body.action,
    );
    res.json({ meeting });
  } catch (err) {
    next(err);
  }
}

export async function adminCancelMeeting(req: Request, res: Response, next: NextFunction) {
  try {
    const meeting = await conversations.cancelMeeting(
      adminActor(req),
      req.params.id as string,
      req.params.meetingId as string,
    );
    res.json({ meeting });
  } catch (err) {
    next(err);
  }
}

export async function adminListNotes(req: Request, res: Response, next: NextFunction) {
  try {
    const notes = await conversations.listNotes(adminActor(req), req.params.id as string);
    res.json({ notes });
  } catch (err) {
    next(err);
  }
}

export async function adminAddNote(req: Request, res: Response, next: NextFunction) {
  try {
    const note = await conversations.addNote(adminActor(req), req.params.id as string, req.body.body);
    res.status(201).json({ note });
  } catch (err) {
    next(err);
  }
}

export async function adminSetBusinessSalesperson(req: Request, res: Response, next: NextFunction) {
  try {
    await conversations.setBusinessDefaultSalesperson(
      req.params.businessId as string,
      req.body.staff_user_id,
    );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

export async function adminListStaffOptions(_req: Request, res: Response, next: NextFunction) {
  try {
    const staff = await conversations.listActiveStaff();
    res.json({ staff });
  } catch (err) {
    next(err);
  }
}

export async function adminGetFallbackSalesperson(_req: Request, res: Response, next: NextFunction) {
  try {
    const { getAdminSetting } = await import('../services/admin.service.js');
    const staff_user_id = await getAdminSetting<string | null>('fallback_salesperson_id');
    res.json({ staff_user_id: typeof staff_user_id === 'string' ? staff_user_id : null });
  } catch (err) {
    next(err);
  }
}

export async function adminSetFallbackSalesperson(req: Request, res: Response, next: NextFunction) {
  try {
    const { setAdminSetting } = await import('../services/admin.service.js');
    await setAdminSetting('fallback_salesperson_id', req.body.staff_user_id, req.user!.id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}
