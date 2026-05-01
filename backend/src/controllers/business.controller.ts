import { Request, Response, NextFunction } from 'express';
import * as businessService from '../services/business.service.js';
import * as talentAccessService from '../services/talent-access.service.js';

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

// ─── Subscribed Categories & Shared Profiles ────────────────────────────────

export async function getMyCategories(req: Request, res: Response, next: NextFunction) {
  try {
    const categories = await businessService.getSubscribedCategories(req.user!.id);
    res.json({ categories });
  } catch (err) {
    next(err);
  }
}

export async function getSharedProfiles(req: Request, res: Response, next: NextFunction) {
  try {
    const profiles = await businessService.getSharedProfiles(
      req.user!.id,
      req.params.categoryId as string
    );
    res.json({ profiles });
  } catch (err) {
    next(err);
  }
}

export async function getSharedProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const profile = await businessService.getSharedProfile(
      req.user!.id,
      req.params.categoryId as string,
      req.params.profileId as string
    );
    res.json({ profile });
  } catch (err) {
    next(err);
  }
}

export async function getSharedProfilePortfolio(req: Request, res: Response, next: NextFunction) {
  try {
    const items = await businessService.getPortfolioForProfile(
      req.user!.id,
      req.params.categoryId as string,
      req.params.profileId as string
    );
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

// ─── Subscription cards ─────────────────────────────────────────────────────

export async function getMySubscriptionCards(req: Request, res: Response, next: NextFunction) {
  try {
    const cards = await businessService.listMySubscriptionCards(req.user!.id);
    res.json({ cards });
  } catch (err) {
    next(err);
  }
}

export async function getMySubscriptionCard(req: Request, res: Response, next: NextFunction) {
  try {
    const card = await businessService.getMySubscriptionCard(
      req.user!.id,
      req.params.cardId as string,
    );
    res.json({ card });
  } catch (err) {
    next(err);
  }
}

export async function getShortlistedProfilesForCard(req: Request, res: Response, next: NextFunction) {
  try {
    const profiles = await businessService.getShortlistedProfilesForCard(
      req.user!.id,
      req.params.cardId as string,
    );
    res.json({ profiles });
  } catch (err) {
    next(err);
  }
}

// ─── Talent Access (bridged via business user email) ───────────────────────

async function resolveAccessSession(req: Request) {
  const business = await businessService.getBusinessUser(req.user!.id);
  const email = business.contact_email;
  if (!email) return null;
  return talentAccessService.getSessionForEmail(email);
}

export async function getTalentAccessStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const business = await businessService.getBusinessUser(req.user!.id);
    const email = business.contact_email;
    if (!email) {
      res.json({ has_access: false });
      return;
    }
    const session = await talentAccessService.getSessionForEmail(email);
    if (!session) {
      res.json({ has_access: false });
      return;
    }
    const info = await talentAccessService.getSessionInfo(session);
    res.json({ has_access: true, ...info });
  } catch (err) {
    next(err);
  }
}

export async function getTalentAccessProfiles(req: Request, res: Response, next: NextFunction) {
  try {
    const session = await resolveAccessSession(req);
    if (!session) {
      res.json({ profiles: [], page: 1, per_page: 20, total: 0 });
      return;
    }
    const result = await talentAccessService.listProfiles(session, req.query as any);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getTalentAccessProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const session = await resolveAccessSession(req);
    if (!session) {
      res.status(403).json({ error: 'No talent access for this account' });
      return;
    }
    const result = await talentAccessService.getProfile(session, req.params.id as string);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getTalentAccessFilterOptions(req: Request, res: Response, next: NextFunction) {
  try {
    const session = await resolveAccessSession(req);
    if (!session) {
      res.json({ tiers: [], locations: [], languages: [], skills: [], tools: [], ai_tools: [] });
      return;
    }
    const result = await talentAccessService.getFilterOptions(session, req.query.category_id as string);
    res.json(result);
  } catch (err) {
    next(err);
  }
}
