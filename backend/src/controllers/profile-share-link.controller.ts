import { Request, Response, NextFunction } from 'express';
import * as shareLinkService from '../services/profile-share-link.service.js';

export async function createLink(req: Request, res: Response, next: NextFunction) {
  try {
    const profileId = req.params.profileId as string;
    const createdBy = req.user?.id ?? null;
    const { expires_at } = req.body;
    const result = await shareLinkService.createShareLink(profileId, createdBy, {
      expiresAt: expires_at,
    });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function listLinks(req: Request, res: Response, next: NextFunction) {
  try {
    const profileId = req.params.profileId as string;
    const links = await shareLinkService.listShareLinks(profileId);
    res.json({ links });
  } catch (err) {
    next(err);
  }
}

export async function revokeLink(req: Request, res: Response, next: NextFunction) {
  try {
    const profileId = req.params.profileId as string;
    const linkId = req.params.linkId as string;
    const result = await shareLinkService.revokeShareLink(profileId, linkId);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getPublicShare(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.params.token as string;
    const data = await shareLinkService.getPublicProfileShareData(token);
    res.json(data);
  } catch (err) {
    next(err);
  }
}
