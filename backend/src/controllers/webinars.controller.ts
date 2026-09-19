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

export async function deleteAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const svc = await import('../services/webinars.service.js');
    res.json(await svc.deleteWebinar(req.params.id as string));
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
