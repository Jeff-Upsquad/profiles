import { Request, Response, NextFunction } from 'express';
import * as businessService from '../services/business.service.js';

export async function getMe(req: Request, res: Response, next: NextFunction) {
  try {
    const business = await businessService.getBusinessUser(req.user!.id);
    res.json({ business });
  } catch (err) {
    next(err);
  }
}

export async function updateMe(req: Request, res: Response, next: NextFunction) {
  try {
    const business = await businessService.updateBusinessUser(req.user!.id, req.body);
    res.json({ business });
  } catch (err) {
    next(err);
  }
}

export async function discoverProfiles(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await businessService.discoverProfiles(
      req.params.categorySlug as string,
      req.query as any
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const profile = await businessService.getApprovedProfile(
      req.params.categorySlug as string,
      req.params.id as string
    );
    res.json({ profile });
  } catch (err) {
    next(err);
  }
}

export async function getShortlist(req: Request, res: Response, next: NextFunction) {
  try {
    const profiles = await businessService.getShortlist(req.user!.id);
    res.json({ profiles });
  } catch (err) {
    next(err);
  }
}

export async function addToShortlist(req: Request, res: Response, next: NextFunction) {
  try {
    await businessService.addToShortlist(req.user!.id, req.params.profileId as string);
    res.status(201).json({ message: 'Added to shortlist' });
  } catch (err) {
    next(err);
  }
}

export async function removeFromShortlist(req: Request, res: Response, next: NextFunction) {
  try {
    await businessService.removeFromShortlist(req.user!.id, req.params.profileId as string);
    res.json({ message: 'Removed from shortlist' });
  } catch (err) {
    next(err);
  }
}

export async function sendInterest(req: Request, res: Response, next: NextFunction) {
  try {
    const interest = await businessService.sendInterest(
      req.user!.id,
      req.params.profileId as string,
      req.body
    );
    res.status(201).json({ interest });
  } catch (err) {
    next(err);
  }
}

export async function getInterests(req: Request, res: Response, next: NextFunction) {
  try {
    const interests = await businessService.getInterests(req.user!.id);
    res.json({ interests });
  } catch (err) {
    next(err);
  }
}
