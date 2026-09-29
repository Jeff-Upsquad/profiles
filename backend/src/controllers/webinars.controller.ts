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
    const { supabaseAdmin } = await import('../config/supabase.js');
    const { data: webinar } = await supabaseAdmin.from('training_webinars')
      .select('recipient_type').eq('id', req.params.id as string).maybeSingle();
    if (webinar?.recipient_type === 'agency') {
      const svc = await import('../services/agency-webinars.service.js');
      res.json(await svc.setAgencyAttended(req.params.id as string, req.params.talentUserId as string, attended));
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

export async function listLanguagesForTalent(req: Request, res: Response, next: NextFunction) {
  try {
    const svc = await import('../services/webinars.service.js');
    res.json({ languages: await svc.listActiveWebinarLanguages() });
  } catch (err) {
    next(err);
  }
}

export async function listInterests(req: Request, res: Response, next: NextFunction) {
  try {
    const svc = await import('../services/webinars.service.js');
    res.json({ interests: await svc.getWebinarInterests(req.user!.id) });
  } catch (err) {
    next(err);
  }
}

export async function addInterest(req: Request, res: Response, next: NextFunction) {
  try {
    const svc = await import('../services/webinars.service.js');
    res.status(201).json(await svc.addWebinarInterest(req.user!.id, String((req.body as any)?.language ?? '')));
  } catch (err) {
    next(err);
  }
}

export async function removeInterest(req: Request, res: Response, next: NextFunction) {
  try {
    const svc = await import('../services/webinars.service.js');
    res.json(await svc.removeWebinarInterest(req.user!.id, req.params.language as string));
  } catch (err) {
    next(err);
  }
}

// Admin — webinar language allow-list.
export async function listLanguagesAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const svc = await import('../services/webinars.service.js');
    res.json(await svc.listAllWebinarLanguages());
  } catch (err) {
    next(err);
  }
}

export async function upsertLanguageAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const svc = await import('../services/webinars.service.js');
    const { code, label } = req.body as { code: string; label: string };
    res.status(201).json(await svc.upsertWebinarLanguage(code, label));
  } catch (err) {
    next(err);
  }
}

export async function setLanguageActiveAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const svc = await import('../services/webinars.service.js');
    const { is_active } = req.body as { is_active: boolean };
    res.json(await svc.setWebinarLanguageActive(req.params.code as string, is_active));
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
