import { Request, Response, NextFunction } from 'express';
import * as squadService from '../services/squad.service.js';

export async function createInvite(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await squadService.createSquadInvite(req.user!.id, req.body);
    res.status(201).json(data);
  } catch (e) { next(e); }
}
export async function listInvites(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await squadService.listSquadWithInvites(req.user!.id);
    res.json(data);
  } catch (e) { next(e); }
}
export async function squadSignup(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await squadService.squadSignup(req.body);
    res.status(201).json(data);
  } catch (e) { next(e); }
}
export async function getSquadMe(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await squadService.getSquadMe(req.user!.id);
    res.json(data);
  } catch (e) { next(e); }
}
export async function updateSquadMe(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await squadService.updateSquadMe(req.user!.id, req.body);
    res.json(data);
  } catch (e) { next(e); }
}
export async function listMyJobProfiles(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await squadService.squadListJobProfiles(req.user!.id);
    res.json(data);
  } catch (e) { next(e); }
}
export async function createMyJobProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await squadService.squadCreateJobProfile(req.user!.id, req.body);
    res.status(201).json(data);
  } catch (e) { next(e); }
}
export async function updateMyJobProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await squadService.squadUpdateJobProfile(req.user!.id, req.params.id as string, req.body);
    res.json(data);
  } catch (e) { next(e); }
}
export async function deleteMyJobProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await squadService.squadDeleteJobProfile(req.user!.id, req.params.id as string);
    res.json(data);
  } catch (e) { next(e); }
}
export async function getAllowedCategories(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await squadService.squadGetAllowedCategories(req.user!.id);
    res.json(data);
  } catch (e) { next(e); }
}
