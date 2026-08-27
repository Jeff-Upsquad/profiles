import { Request, Response, NextFunction } from 'express';
import * as svc from '../services/agency-admin.service.js';

export async function getStats(_req: Request, res: Response, next: NextFunction) {
  try { res.json(await svc.getAgencyStats()); } catch (e) { next(e); }
}

export async function listAgencies(req: Request, res: Response, next: NextFunction) {
  try {
    const filters = {
      search: req.query.search as string | undefined,
      approval_status: req.query.approval_status as string | undefined,
      is_active: req.query.is_active !== undefined ? req.query.is_active === 'true' : undefined,
      page: req.query.page ? Number(req.query.page) : 1,
      limit: req.query.limit ? Number(req.query.limit) : 20,
    };
    res.json(await svc.listAgencies(filters));
  } catch (e) { next(e); }
}

export async function getPending(req: Request, res: Response, next: NextFunction) {
  try { res.json({ agencies: await svc.getPendingAgencies() }); } catch (e) { next(e); }
}

export async function getDetail(req: Request, res: Response, next: NextFunction) {
  try { res.json(await svc.getAgencyDetail(req.params.id as string)); } catch (e) { next(e); }
}

export async function approve(req: Request, res: Response, next: NextFunction) {
  try { res.json(await svc.approveAgency(req.params.id as string, req.user!.id)); } catch (e) { next(e); }
}

export async function reject(req: Request, res: Response, next: NextFunction) {
  try {
    const { reason } = req.body as { reason?: string };
    res.json(await svc.rejectAgency(req.params.id as string, req.user!.id, reason ?? ''));
  } catch (e) { next(e); }
}

export async function bulkApprove(req: Request, res: Response, next: NextFunction) {
  try {
    const { ids } = req.body as { ids?: string[] };
    if (!Array.isArray(ids) || ids.length === 0) { res.status(400).json({ message: 'ids array required' }); return; }
    res.json({ results: await svc.bulkApproveAgencies(ids, req.user!.id) });
  } catch (e) { next(e); }
}

export async function checkDuplicate(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, phone, exclude_id } = req.query as Record<string, string | undefined>;
    const body = req.body as any;
    const e = (body?.email ?? email) as string | undefined;
    const p = (body?.phone ?? phone) as string | undefined;
    const ex = (body?.exclude_id ?? exclude_id) as string | undefined;
    res.json(await svc.checkDuplicate({ email: e, phone: p, excludeId: ex }));
  } catch (e) { next(e); }
}

export async function updateAgency(req: Request, res: Response, next: NextFunction) {
  try { res.json(await svc.updateAgency(req.params.id as string, req.body)); } catch (e) { next(e); }
}

export async function setActive(req: Request, res: Response, next: NextFunction) {
  try { res.json(await svc.setAgencyActive(req.params.id as string, Boolean(req.body.is_active))); } catch (e) { next(e); }
}

export async function suspend(req: Request, res: Response, next: NextFunction) {
  try { res.json(await svc.suspendAgency(req.params.id as string, req.body.suspend ?? true, req.body.reason ?? null)); } catch (e) { next(e); }
}

export async function blacklist(req: Request, res: Response, next: NextFunction) {
  try { res.json(await svc.blacklistAgency(req.params.id as string, req.body.blacklist ?? true, req.body.reason ?? null)); } catch (e) { next(e); }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try { res.json(await svc.deleteAgency(req.params.id as string)); } catch (e) { next(e); }
}
