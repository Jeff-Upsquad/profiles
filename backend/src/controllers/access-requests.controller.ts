import { Request, Response, NextFunction } from 'express';
import * as accessRequestsService from '../services/access-requests.service.js';

export async function listPendingRequests(_req: Request, res: Response, next: NextFunction) {
  try {
    const data = await accessRequestsService.listPendingRequests();
    res.json(data);
  } catch (err) { next(err); }
}

export async function grantBusinessAccess(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await accessRequestsService.grantBusinessAccess(
      req.params.businessId as string,
      req.body.expiresAt as string,
    );
    res.json(data);
  } catch (err) { next(err); }
}

export async function grantCourseReopen(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await accessRequestsService.grantCourseReopen(
      req.params.requestId as string,
      req.user!.id,
    );
    res.json(data);
  } catch (err) { next(err); }
}

export async function rejectCourseReopen(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await accessRequestsService.rejectCourseReopen(
      req.params.requestId as string,
      req.user!.id,
      req.body.admin_notes,
    );
    res.json(data);
  } catch (err) { next(err); }
}
