import { Request, Response, NextFunction } from 'express';

// Admin — SquadHire Training → Webinars module.
export async function listAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const svc = await import('../services/webinars.service.js');
    res.json(await svc.listAdminWebinars());
  } catch (err) {
    next(err);
  }
}

export async function createAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const svc = await import('../services/webinars.service.js');
    res.status(201).json(await svc.createWebinar(req.body, req.user?.id ?? null));
  } catch (err) {
    next(err);
  }
}

export async function updateAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const svc = await import('../services/webinars.service.js');
    res.json(await svc.updateWebinar(req.params.id as string, req.body));
  } catch (err) {
    next(err);
  }
}

export async function rescheduleAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const svc = await import('../services/webinars.service.js');
    res.json(await svc.rescheduleWebinar(req.params.id as string, req.body));
  } catch (err) {
    next(err);
  }
}

export async function deleteAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const svc = await import('../services/webinars.service.js');
    res.json(await svc.deleteWebinar(req.params.id as string));
  } catch (err) {
    next(err);
  }
}

export async function listRegistrations(req: Request, res: Response, next: NextFunction) {
  try {
    const svc = await import('../services/webinars.service.js');
    res.json(await svc.listWebinarRegistrations(req.params.id as string));
  } catch (err) {
    next(err);
  }
}

// Tick the talent's onboarding-webinar checklist item from the registrant list.
export async function setAttended(req: Request, res: Response, next: NextFunction) {
  try {
    const { attended } = req.body as { attended?: unknown };
    if (typeof attended !== 'boolean') {
      res.status(400).json({ message: 'attended (boolean) required' });
      return;
    }
    const hub = await import('../services/onboarding-hub.service.js');
    res.json(await hub.setWebinarAttended(req.params.talentUserId as string, attended, req.user!.id));
  } catch (err) {
    next(err);
  }
}

// Talent — inside Training.
export async function listForTalent(req: Request, res: Response, next: NextFunction) {
  try {
    const svc = await import('../services/webinars.service.js');
    res.json({ webinars: await svc.listUpcomingForTalent(req.user!.id) });
  } catch (err) {
    next(err);
  }
}

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const svc = await import('../services/webinars.service.js');
    res.json(await svc.registerForWebinar(req.user!.id, req.params.id as string));
  } catch (err) {
    next(err);
  }
}

export async function unregister(req: Request, res: Response, next: NextFunction) {
  try {
    const svc = await import('../services/webinars.service.js');
    res.json(await svc.unregisterFromWebinar(req.user!.id, req.params.id as string));
  } catch (err) {
    next(err);
  }
}
