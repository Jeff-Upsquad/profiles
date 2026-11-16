import { Request, Response, NextFunction } from 'express';
import * as shareLinkService from '../services/agency-share-link.service.js';

export async function createLink(req: Request, res: Response, next: NextFunction) {
  try {
    const agencyUserId = req.user!.id;
    const { category_id, expires_at } = req.body;
    const result = await shareLinkService.createShareLink(agencyUserId, {
      categoryId: category_id,
      expiresAt: expires_at,
    });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function listLinks(req: Request, res: Response, next: NextFunction) {
  try {
    const agencyUserId = req.user!.id;
    const categoryId = typeof req.query.category_id === 'string' ? req.query.category_id : undefined;
    const links = await shareLinkService.listShareLinks(agencyUserId, categoryId);
    res.json(links);
  } catch (err) {
    next(err);
  }
}

export async function revokeLink(req: Request, res: Response, next: NextFunction) {
  try {
    const agencyUserId = req.user!.id;
    const linkId = req.params.id as string;
    const result = await shareLinkService.revokeShareLink(agencyUserId, linkId);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getPublicShare(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.params.token as string;
    const data = await shareLinkService.getPublicShareLinkData(token);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function getPublicShareMember(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.params.token as string;
    const memberId = req.params.memberId as string;
    const data = await shareLinkService.getPublicShareMemberData(token, memberId);
    res.json(data);
  } catch (err) {
    next(err);
  }
}
