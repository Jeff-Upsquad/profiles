import { Request, Response, NextFunction } from 'express';
import * as jobsService from '../services/jobs.service.js';
import * as interviewsService from '../services/interviews.service.js';
import * as offersService from '../services/offers.service.js';
import * as jobQuestionsService from '../services/job-questions.service.js';
import * as subscriptionService from '../services/subscription.service.js';

// ─── Opt-in + preferences ──────────────────────────────────────────────────

export async function getPreferences(req: Request, res: Response, next: NextFunction) {
  try {
    const preferences = await jobsService.getJobPreferences(req.user!.id);
    res.json({ preferences });
  } catch (err) {
    next(err);
  }
}

export async function optIn(req: Request, res: Response, next: NextFunction) {
  try {
    const preferences = await jobsService.optInToJobs(req.user!.id, req.body);
    res.status(201).json({ preferences });
  } catch (err) {
    next(err);
  }
}

export async function optOut(req: Request, res: Response, next: NextFunction) {
  try {
    const preferences = await jobsService.optOutOfJobs(req.user!.id);
    res.json({ preferences });
  } catch (err) {
    next(err);
  }
}

export async function updatePreferences(req: Request, res: Response, next: NextFunction) {
  try {
    const preferences = await jobsService.updateJobPreferences(req.user!.id, req.body);
    res.json({ preferences });
  } catch (err) {
    next(err);
  }
}

// ─── Feed ──────────────────────────────────────────────────────────────────

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const { tab } = req.query as { tab: jobsService.TalentJobsTab };
    const jobs = await jobsService.listJobsForTalent(req.user!.id, tab);
    res.json({ jobs });
  } catch (err) {
    next(err);
  }
}

export async function unreadCount(req: Request, res: Response, next: NextFunction) {
  try {
    const count = await jobsService.getUnreadJobsCount(req.user!.id);
    res.json({ count });
  } catch (err) {
    next(err);
  }
}

export async function detail(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await jobsService.getJobDetailForTalent(
      req.user!.id,
      req.params.recipientId as string,
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function respond(req: Request, res: Response, next: NextFunction) {
  try {
    // Same primitive as the subscription feed — the hiring hook inside
    // respond() creates the job_candidates row on accept.
    const result = await subscriptionService.respond(
      req.user!.id,
      req.params.recipientId as string,
      req.body,
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// ─── Job profile view + Q&A ────────────────────────────────────────────────

export async function jobProfileView(req: Request, res: Response, next: NextFunction) {
  try {
    const jobProfileId = req.params.jobProfileId as string;
    const profile = await jobsService.getJobProfileViewForTalent(req.user!.id, jobProfileId);
    const questions = await jobQuestionsService.listQuestionsForTalent(jobProfileId, req.user!.id);
    // The viewer's own recipient — powers the Accept / Decline / Ask bar at
    // the top of the profile view.
    const recipient = await jobsService.getViewerRecipientForProfile(req.user!.id, jobProfileId);
    res.json({ profile, questions, recipient });
  } catch (err) {
    next(err);
  }
}

export async function askQuestion(req: Request, res: Response, next: NextFunction) {
  try {
    const question = await jobQuestionsService.askQuestion(
      req.user!.id,
      req.params.jobProfileId as string,
      req.body,
    );
    res.status(201).json({ question });
  } catch (err) {
    next(err);
  }
}

// ─── Interview invites ─────────────────────────────────────────────────────

export async function listInvites(req: Request, res: Response, next: NextFunction) {
  try {
    const invites = await interviewsService.listInvitesForTalent(req.user!.id);
    res.json({ invites });
  } catch (err) {
    next(err);
  }
}

export async function respondToInvite(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await interviewsService.respondToInvite(
      req.user!.id,
      req.params.inviteId as string,
      (req.body as { action: 'accept' | 'decline' }).action,
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function confirmInvite(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await interviewsService.confirmAttendance(
      req.user!.id,
      req.params.inviteId as string,
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function inviteQueue(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await interviewsService.getQueueForTalent(
      req.user!.id,
      req.params.inviteId as string,
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// ─── Offers ────────────────────────────────────────────────────────────────

export async function listOffers(req: Request, res: Response, next: NextFunction) {
  try {
    const offers = await offersService.listOffersForTalent(req.user!.id);
    res.json({ offers });
  } catch (err) {
    next(err);
  }
}

export async function offerDetail(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await offersService.getOfferForTalent(
      req.user!.id,
      req.params.offerId as string,
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function respondToOffer(req: Request, res: Response, next: NextFunction) {
  try {
    const offer = await offersService.respondToOffer(
      req.user!.id,
      req.params.offerId as string,
      req.body,
    );
    res.json({ offer });
  } catch (err) {
    next(err);
  }
}

export async function askOfferQuestion(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await offersService.askOfferQuestion(
      req.user!.id,
      req.params.offerId as string,
      (req.body as { question: string }).question,
    );
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}
