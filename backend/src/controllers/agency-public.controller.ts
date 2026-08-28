import { Request, Response, NextFunction } from 'express';
import * as svc from '../services/agency-public.service.js';

export async function getAgencyPublicView(req: Request, res: Response, next: NextFunction) {
  try {
    const agencyId = req.params.agencyId as string;
    const categoryId = (req.query.category_id as string) || (req.query.categoryId as string) || undefined;
    const data = await svc.getAgencyPublicView(agencyId, { categoryId });
    res.json(data);
  } catch (e) { next(e); }
}

export async function getAgencyMemberPublicView(req: Request, res: Response, next: NextFunction) {
  try {
    const agencyId = req.params.agencyId as string;
    const memberId = req.params.memberId as string;
    const data = await svc.getAgencyMemberPublicView(agencyId, memberId);
    res.json(data);
  } catch (e) { next(e); }
}
