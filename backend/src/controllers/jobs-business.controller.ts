import { businessProfileDetailsSchema, locationDetailsSchema, profileKindSchema, type JobBriefInput } from '../validators/job-brief.validators.js';
import * as businessService from '../services/business.service.js';
import { hiringRequest, submitJobBrief } from '../services/squadhub-leads.service.js';
import { ingestPendingBrief } from '../services/subscription.service.js';
import { AppError } from '../middleware/errorHandler.middleware.js';
import { Request, Response, NextFunction } from 'express';
import * as jobsService from '../services/jobs.service.js';
import * as interviewsService from '../services/interviews.service.js';
import * as offersService from '../services/offers.service.js';
import * as jobQuestionsService from '../services/job-questions.service.js';
import type { JobsActor } from '../services/jobs.service.js';

function businessActor(req: Request): JobsActor {
  return { type: 'business', id: req.user!.id };
}

// ─── Cards ─────────────────────────────────────────────────────────────────

export async function listCards(req: Request, res: Response, next: NextFunction) {
  try {
    const cards = await jobsService.listJobCardsForBusiness(req.user!.id);
    res.json({ cards });
  } catch (err) {
    next(err);
  }
}

export async function getCard(req: Request, res: Response, next: NextFunction) {
  try {
    const card = await jobsService.getJobCardForBusiness(
      req.user!.id,
      req.params.cardId as string,
    );
    res.json(card);
  } catch (err) {
    next(err);
  }
}

export async function startScreening(req: Request, res: Response, next: NextFunction) {
  try {
    const cardId = req.params.cardId as string;
    await jobsService.assertBusinessOwnsCard(req.user!.id, cardId);
    const result = await jobsService.startScreening(cardId, businessActor(req));
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// ─── Candidates ────────────────────────────────────────────────────────────

export async function listCandidates(req: Request, res: Response, next: NextFunction) {
  try {
    const cardId = req.params.cardId as string;
    await jobsService.assertBusinessOwnsCard(req.user!.id, cardId);
    const { stage } = req.query as { stage?: jobsService.JobFunnelStage };
    const candidates = await jobsService.listCandidates(cardId, stage);
    // Opening the list counts as reviewing it: clears the "new" marks and
    // re-arms the card's WhatsApp alerts. Fire-and-forget.
    void jobsService.onBusinessViewedJobCandidates(cardId);
    res.json({ candidates });
  } catch (err) {
    next(err);
  }
}

export async function candidateProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const cardId = req.params.cardId as string;
    const candidateId = req.params.candidateId as string;
    const result = await jobsService.getCandidateProfileForBusiness(req.user!.id, cardId, candidateId);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function reviewCandidate(req: Request, res: Response, next: NextFunction) {
  try {
    const cardId = req.params.cardId as string;
    await jobsService.assertBusinessOwnsCard(req.user!.id, cardId);
    const candidate = await jobsService.reviewCandidate(
      cardId,
      req.params.candidateId as string,
      req.body,
      businessActor(req),
    );
    res.json({ candidate });
  } catch (err) {
    next(err);
  }
}

export async function hireCandidate(req: Request, res: Response, next: NextFunction) {
  try {
    const cardId = req.params.cardId as string;
    await jobsService.assertBusinessOwnsCard(req.user!.id, cardId);
    const result = await jobsService.hireCandidate(
      cardId,
      req.params.candidateId as string,
      req.body,
      businessActor(req),
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function markJoined(req: Request, res: Response, next: NextFunction) {
  try {
    const cardId = req.params.cardId as string;
    await jobsService.assertBusinessOwnsCard(req.user!.id, cardId);
    const candidate = await jobsService.markJoined(
      cardId,
      req.params.candidateId as string,
      businessActor(req),
    );
    res.json({ candidate });
  } catch (err) {
    next(err);
  }
}

export async function closeCard(req: Request, res: Response, next: NextFunction) {
  try {
    const cardId = req.params.cardId as string;
    await jobsService.assertBusinessOwnsCard(req.user!.id, cardId);
    const result = await jobsService.closeJobCard(cardId, 'cancelled', businessActor(req));
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// ─── Q&A ───────────────────────────────────────────────────────────────────

export async function listQuestions(req: Request, res: Response, next: NextFunction) {
  try {
    const cardId = req.params.cardId as string;
    const refs = await jobsService.assertBusinessOwnsCard(req.user!.id, cardId);
    const questions = await jobQuestionsService.listQuestionsForBusiness(refs.jobProfileId);
    res.json({ questions });
  } catch (err) {
    next(err);
  }
}

export async function answerQuestion(req: Request, res: Response, next: NextFunction) {
  try {
    const questionId = req.params.questionId as string;
    await jobQuestionsService.assertQuestionBelongsToBusiness(questionId, req.user!.id);
    const question = await jobQuestionsService.answerQuestion(
      questionId,
      (req.body as { answer: string }).answer,
      businessActor(req),
    );
    res.json({ question });
  } catch (err) {
    next(err);
  }
}

export async function deleteQuestion(req: Request, res: Response, next: NextFunction) {
  try {
    const questionId = req.params.questionId as string;
    await jobQuestionsService.assertQuestionBelongsToBusiness(questionId, req.user!.id);
    const result = await jobQuestionsService.deleteQuestion(questionId, businessActor(req));
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// ─── Interview rounds ──────────────────────────────────────────────────────

export async function listRounds(req: Request, res: Response, next: NextFunction) {
  try {
    const cardId = req.params.cardId as string;
    await jobsService.assertBusinessOwnsCard(req.user!.id, cardId);
    const rounds = await interviewsService.listRoundsForCard(cardId);
    res.json({ rounds });
  } catch (err) {
    next(err);
  }
}

export async function createRound(req: Request, res: Response, next: NextFunction) {
  try {
    const cardId = req.params.cardId as string;
    await jobsService.assertBusinessOwnsCard(req.user!.id, cardId);
    const round = await interviewsService.createRound(cardId, req.body, businessActor(req));
    res.status(201).json({ round });
  } catch (err) {
    next(err);
  }
}

export async function updateRound(req: Request, res: Response, next: NextFunction) {
  try {
    const roundId = req.params.roundId as string;
    await interviewsService.assertRoundBelongsToBusinessCard(roundId, req.user!.id);
    const round = await interviewsService.updateRound(roundId, req.body, businessActor(req));
    res.json({ round });
  } catch (err) {
    next(err);
  }
}

export async function cancelRound(req: Request, res: Response, next: NextFunction) {
  try {
    const roundId = req.params.roundId as string;
    await interviewsService.assertRoundBelongsToBusinessCard(roundId, req.user!.id);
    const round = await interviewsService.cancelRound(roundId, businessActor(req));
    res.json({ round });
  } catch (err) {
    next(err);
  }
}

export async function dayConsole(req: Request, res: Response, next: NextFunction) {
  try {
    const roundId = req.params.roundId as string;
    await interviewsService.assertRoundBelongsToBusinessCard(roundId, req.user!.id);
    const console_ = await interviewsService.getDayConsole(roundId);
    res.json(console_);
  } catch (err) {
    next(err);
  }
}

export async function markShowedUp(req: Request, res: Response, next: NextFunction) {
  try {
    const roundId = req.params.roundId as string;
    await interviewsService.assertRoundBelongsToBusinessCard(roundId, req.user!.id);
    const invite = await interviewsService.markShowedUp(
      roundId,
      req.params.inviteId as string,
      businessActor(req),
    );
    res.json({ invite });
  } catch (err) {
    next(err);
  }
}

export async function startInterview(req: Request, res: Response, next: NextFunction) {
  try {
    const roundId = req.params.roundId as string;
    await interviewsService.assertRoundBelongsToBusinessCard(roundId, req.user!.id);
    const invite = await interviewsService.startInterview(
      roundId,
      req.params.inviteId as string,
      businessActor(req),
    );
    res.json({ invite });
  } catch (err) {
    next(err);
  }
}

export async function markAbsent(req: Request, res: Response, next: NextFunction) {
  try {
    const roundId = req.params.roundId as string;
    await interviewsService.assertRoundBelongsToBusinessCard(roundId, req.user!.id);
    const result = await interviewsService.markAbsent(
      roundId,
      req.params.inviteId as string,
      (req.body as { kind: 'no_show' | 'not_joined' }).kind,
      businessActor(req),
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function interviewOutcome(req: Request, res: Response, next: NextFunction) {
  try {
    const roundId = req.params.roundId as string;
    await interviewsService.assertRoundBelongsToBusinessCard(roundId, req.user!.id);
    const invite = await interviewsService.setInterviewOutcome(
      roundId,
      req.params.inviteId as string,
      (req.body as { outcome: 'selected' | 'rejected' | 'on_hold' }).outcome,
      businessActor(req),
    );
    res.json({ invite });
  } catch (err) {
    next(err);
  }
}

// ─── Offers ────────────────────────────────────────────────────────────────

async function assertOfferOwnership(req: Request): Promise<string> {
  const offerId = req.params.offerId as string;
  const offer = await offersService.getOffer(offerId);
  await jobsService.assertBusinessOwnsCard(req.user!.id, offer.card_id);
  return offerId;
}

export async function listOffers(req: Request, res: Response, next: NextFunction) {
  try {
    const cardId = req.params.cardId as string;
    await jobsService.assertBusinessOwnsCard(req.user!.id, cardId);
    const offers = await offersService.listOffersForCard(cardId);
    res.json({ offers });
  } catch (err) {
    next(err);
  }
}

export async function getOfferTemplate(req: Request, res: Response, next: NextFunction) {
  try {
    const cardId = req.params.cardId as string;
    const refs = await jobsService.assertBusinessOwnsCard(req.user!.id, cardId);
    if (!refs.externalId) {
      res.status(404).json({ error: 'Card has no SquadHub external id', message: 'Card has no SquadHub external id' });
      return;
    }
    const template = await offersService.fetchOfferTemplate(refs.externalId);
    res.json(template);
  } catch (err) {
    next(err);
  }
}

export async function createOffers(req: Request, res: Response, next: NextFunction) {
  try {
    const cardId = req.params.cardId as string;
    await jobsService.assertBusinessOwnsCard(req.user!.id, cardId);
    const result = await offersService.createOffers(cardId, req.body, businessActor(req));
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function updateOffer(req: Request, res: Response, next: NextFunction) {
  try {
    const offerId = await assertOfferOwnership(req);
    const offer = await offersService.updateOfferPackage(offerId, req.body, businessActor(req));
    res.json({ offer });
  } catch (err) {
    next(err);
  }
}

export async function sendOffer(req: Request, res: Response, next: NextFunction) {
  try {
    const offerId = await assertOfferOwnership(req);
    const offer = await offersService.sendOffer(
      offerId,
      (req.body as { letter?: Record<string, unknown> }).letter,
      businessActor(req),
    );
    res.json({ offer });
  } catch (err) {
    next(err);
  }
}

export async function markOfferSentManually(req: Request, res: Response, next: NextFunction) {
  try {
    const offerId = await assertOfferOwnership(req);
    const offer = await offersService.markSentManually(offerId, businessActor(req));
    res.json({ offer });
  } catch (err) {
    next(err);
  }
}

export async function acceptNegotiation(req: Request, res: Response, next: NextFunction) {
  try {
    const offerId = await assertOfferOwnership(req);
    const offer = await offersService.acceptNegotiation(offerId, req.body, businessActor(req));
    res.json({ offer });
  } catch (err) {
    next(err);
  }
}

export async function declineNegotiation(req: Request, res: Response, next: NextFunction) {
  try {
    const offerId = await assertOfferOwnership(req);
    const offer = await offersService.declineNegotiation(offerId, req.body, businessActor(req));
    res.json({ offer });
  } catch (err) {
    next(err);
  }
}

export async function counterOffer(req: Request, res: Response, next: NextFunction) {
  try {
    const offerId = await assertOfferOwnership(req);
    const offer = await offersService.counterOffer(offerId, req.body, businessActor(req));
    res.json({ offer });
  } catch (err) {
    next(err);
  }
}

export async function withdrawOffer(req: Request, res: Response, next: NextFunction) {
  try {
    const offerId = await assertOfferOwnership(req);
    const offer = await offersService.withdrawOffer(offerId, businessActor(req));
    res.json({ offer });
  } catch (err) {
    next(err);
  }
}

export async function answerOfferQuestion(req: Request, res: Response, next: NextFunction) {
  try {
    const offerId = await assertOfferOwnership(req);
    const result = await offersService.answerOfferQuestion(
      offerId,
      (req.body as { answer: string }).answer,
      businessActor(req),
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function offerEvents(req: Request, res: Response, next: NextFunction) {
  try {
    const offerId = await assertOfferOwnership(req);
    const events = await offersService.listOfferEvents(offerId);
    res.json({ events });
  } catch (err) {
    next(err);
  }
}

async function hiringIdentity(req: Request) {
  const account = await businessService.getBusinessUser(req.user!.id);
  const email = account.contact_email?.trim() || req.user!.email;
  if (!email) throw new AppError(400, 'Add an email address to your business account first.');
  return { business_user_id: req.user!.id, email,
    phone: account.contact_phone?.trim() || undefined,
    contact_name: account.contact_person_name?.trim() || undefined };
}
export async function getHiringProfiles(req: Request, res: Response, next: NextFunction) {
  try { res.json(await hiringRequest('/profiles', await hiringIdentity(req), 'GET')); }
  catch (err) { next(err); }
}
export async function saveHiringProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const kind = profileKindSchema.parse(req.params.kind);
    const schema = kind === 'business' ? businessProfileDetailsSchema : kind === 'location' ? locationDetailsSchema : null;
    const parsed = schema?.safeParse(req.body.data);
    if (parsed && !parsed.success) throw new AppError(400, parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; '));
    const data = parsed?.success ? parsed.data : req.body.data;
    res.json(await hiringRequest(`/profiles/${kind}`, { ...req.body, data, ...await hiringIdentity(req) }));
  } catch (err) { next(err); }
}
export async function submitBrief(req: Request, res: Response, next: NextFunction) {
  try {
    const body = req.body as JobBriefInput;
    const identity = await hiringIdentity(req);
    const saved = await submitJobBrief({ ...body, ...identity });
    const content = saved.content as Record<string, unknown> | undefined;
    if (!content) throw new AppError(502, 'The hiring service did not return the saved job profile. Please retry.');
    const business = content.business_profile as { name?: string } | undefined;
    const result = await ingestPendingBrief({ external_id: body.request_id, card_type: 'hiring',
      business_user_id: identity.business_user_id, business_email: identity.email,
      business_phone: identity.phone, business_contact_name: identity.contact_name,
      business_company: business?.name, content,
    });
    res.status(201).json({ card_id: result.id });
  } catch (err) { next(err); }
}
