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
    res.json({ candidates });
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
