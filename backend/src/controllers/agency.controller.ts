import { Request, Response, NextFunction } from 'express';
import * as svc from '../services/agency.service.js';

export async function getMe(req: Request, res: Response, next: NextFunction) {
  try { const data = await svc.getAgencyUser(req.user!.id); res.json(data); } catch (e) { next(e); }
}
export async function updateMe(req: Request, res: Response, next: NextFunction) {
  try { const data = await svc.updateAgencyUser(req.user!.id, req.body); res.json(data); } catch (e) { next(e); }
}
export async function getProfile(req: Request, res: Response, next: NextFunction) {
  try { const data = await svc.getAgencyProfile(req.user!.id); res.json(data); } catch (e) { next(e); }
}
export async function updateProfile(req: Request, res: Response, next: NextFunction) {
  try { const data = await svc.upsertAgencyProfile(req.user!.id, req.body); res.json(data); } catch (e) { next(e); }
}
export async function listSquad(req: Request, res: Response, next: NextFunction) {
  try { const data = await svc.listSquadMembers(req.user!.id); res.json(data); } catch (e) { next(e); }
}
export async function createSquad(req: Request, res: Response, next: NextFunction) {
  try { const data = await svc.createSquadMember(req.user!.id, req.body); res.status(201).json(data); } catch (e) { next(e); }
}
export async function updateSquad(req: Request, res: Response, next: NextFunction) {
  try { const data = await svc.updateSquadMember(req.user!.id, req.params.memberId as string, req.body); res.json(data); } catch (e) { next(e); }
}
export async function deleteSquad(req: Request, res: Response, next: NextFunction) {
  try { const data = await svc.deleteSquadMember(req.user!.id, req.params.memberId as string); res.json(data); } catch (e) { next(e); }
}
export async function listMemberProfiles(req: Request, res: Response, next: NextFunction) {
  try { const data = await svc.listMemberProfiles(req.user!.id); res.json(data); } catch (e) { next(e); }
}
export async function createMemberProfile(req: Request, res: Response, next: NextFunction) {
  try { const data = await svc.createMemberProfile(req.user!.id, req.body); res.status(201).json(data); } catch (e) { next(e); }
}
export async function updateMemberProfile(req: Request, res: Response, next: NextFunction) {
  try { const data = await svc.updateMemberProfile(req.user!.id, req.params.id as string, req.body); res.json(data); } catch (e) { next(e); }
}
export async function deleteMemberProfile(req: Request, res: Response, next: NextFunction) {
  try { const data = await svc.deleteMemberProfile(req.user!.id, req.params.id as string); res.json(data); } catch (e) { next(e); }
}
export async function listGeneral(req: Request, res: Response, next: NextFunction) {
  try { const data = await svc.listGeneralPortfolios(req.user!.id); res.json(data); } catch (e) { next(e); }
}
export async function createGeneral(req: Request, res: Response, next: NextFunction) {
  try { const data = await svc.createGeneralPortfolio(req.user!.id, req.body); res.status(201).json(data); } catch (e) { next(e); }
}
export async function updateGeneral(req: Request, res: Response, next: NextFunction) {
  try { const data = await svc.updateGeneralPortfolio(req.user!.id, req.params.id as string, req.body); res.json(data); } catch (e) { next(e); }
}
export async function deleteGeneral(req: Request, res: Response, next: NextFunction) {
  try { const data = await svc.deleteGeneralPortfolio(req.user!.id, req.params.id as string); res.json(data); } catch (e) { next(e); }
}
export async function listPortfolio(req: Request, res: Response, next: NextFunction) {
  try { const data = await svc.listPortfolioItems(req.user!.id, { member_profile_id: req.query.member_profile_id as string, general_portfolio_id: req.query.general_portfolio_id as string }); res.json(data); } catch (e) { next(e); }
}
export async function addPortfolio(req: Request, res: Response, next: NextFunction) {
  try { const data = await svc.addPortfolioItem(req.user!.id, req.body); res.status(201).json(data); } catch (e) { next(e); }
}
export async function deletePortfolio(req: Request, res: Response, next: NextFunction) {
  try { const data = await svc.deletePortfolioItem(req.user!.id, req.params.itemId as string); res.json(data); } catch (e) { next(e); }
}
export async function getTotal(req: Request, res: Response, next: NextFunction) {
  try { const data = await svc.getTotalPortfolio(req.user!.id); res.json(data); } catch (e) { next(e); }
}
