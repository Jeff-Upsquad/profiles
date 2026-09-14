import type { NextFunction, Request, Response } from 'express';
import * as groupMeets from '../services/group-meets.service.js';
import * as businessService from '../services/business.service.js';
import * as talentService from '../services/talent.service.js';

async function businessActor(userId: string): Promise<groupMeets.GroupMeetActor> {
  const business = await businessService.getBusinessUser(userId);
  return { type: 'business', id: userId, name: business.contact_person_name || business.company_name || 'Client' };
}

async function talentName(userId: string): Promise<string> {
  const talent = await talentService.getTalentUser(userId);
  return talent.full_name || 'Talent';
}

export async function businessGet(req: Request, res: Response, next: NextFunction) {
  try { res.json({ meeting: await groupMeets.getForBusiness(req.user!.id, req.params.cardId as string) }); } catch (error) { next(error); }
}
export async function businessSchedule(req: Request, res: Response, next: NextFunction) {
  try { res.status(201).json({ meeting: await groupMeets.schedule(req.user!.id, req.params.cardId as string, req.body, await businessActor(req.user!.id)) }); } catch (error) { next(error); }
}
export async function businessReschedule(req: Request, res: Response, next: NextFunction) {
  try { res.json({ meeting: await groupMeets.reschedule(req.user!.id, req.params.meetingId as string, req.body, await businessActor(req.user!.id)) }); } catch (error) { next(error); }
}
export async function businessCancel(req: Request, res: Response, next: NextFunction) {
  try { res.json({ meeting: await groupMeets.cancel(req.user!.id, req.params.meetingId as string, await businessActor(req.user!.id)) }); } catch (error) { next(error); }
}
export async function businessMessage(req: Request, res: Response, next: NextFunction) {
  try { res.status(201).json({ message: await groupMeets.sendMessage(req.params.meetingId as string, await businessActor(req.user!.id), req.body.body) }); } catch (error) { next(error); }
}
export async function businessJoin(req: Request, res: Response, next: NextFunction) {
  try { res.json({ credentials: await groupMeets.joinForBusiness(req.user!.id, req.params.meetingId as string, await businessActor(req.user!.id)) }); } catch (error) { next(error); }
}
export async function businessLeave(req: Request, res: Response, next: NextFunction) {
  try { await groupMeets.leave(req.params.meetingId as string, { type: 'business', id: req.user!.id }); res.status(204).send(); } catch (error) { next(error); }
}
export async function talentGet(req: Request, res: Response, next: NextFunction) {
  try { res.json({ meeting: await groupMeets.getForTalent(req.user!.id, req.params.meetingId as string) }); } catch (error) { next(error); }
}
export async function talentRespond(req: Request, res: Response, next: NextFunction) {
  try { res.json({ meeting: await groupMeets.respond(req.user!.id, req.params.meetingId as string, req.body.action) }); } catch (error) { next(error); }
}
export async function talentMessage(req: Request, res: Response, next: NextFunction) {
  try { res.status(201).json({ message: await groupMeets.sendMessage(req.params.meetingId as string, { type: 'talent', id: req.user!.id, name: await talentName(req.user!.id) }, req.body.body) }); } catch (error) { next(error); }
}
export async function talentJoin(req: Request, res: Response, next: NextFunction) {
  try { res.json({ credentials: await groupMeets.joinForTalent(req.user!.id, req.params.meetingId as string, await talentName(req.user!.id)) }); } catch (error) { next(error); }
}
export async function talentLeave(req: Request, res: Response, next: NextFunction) {
  try { await groupMeets.leave(req.params.meetingId as string, { type: 'talent', id: req.user!.id }); res.status(204).send(); } catch (error) { next(error); }
}
