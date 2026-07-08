import { Request, Response, NextFunction } from 'express';
import { AppError } from '../middleware/errorHandler.middleware.js';
import * as jobsService from '../services/jobs.service.js';
import * as interviewsService from '../services/interviews.service.js';
import * as offersService from '../services/offers.service.js';
import * as jobQuestionsService from '../services/job-questions.service.js';
import type { JobsActor } from '../services/jobs.service.js';

/**
 * Inbound SquadHub admin-mirror webhooks (/api/webhooks/squadhub/jobs/*).
 *
 * SquadHub admins drive the SAME service functions the business portal uses,
 * with actor {type:'admin', source:'squadhub'} — the source flag makes the
 * services apply the change canonically here while SUPPRESSING the echo
 * outbox event (SquadHub initiated it; an echo would double-apply).
 */

const SQUADHUB_ADMIN: JobsActor = { type: 'admin', id: null, source: 'squadhub' };

export async function handleStage(req: Request, res: Response, next: NextFunction) {
  try {
    const { external_id, action } = req.body as { external_id: string; action: 'start_screening' };
    const cardId = await jobsService.getCardIdByExternalId(external_id);
    if (action !== 'start_screening') throw new AppError(400, `Unknown stage action: ${action}`);
    const result = await jobsService.startScreening(cardId, SQUADHUB_ADMIN);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function handleCandidateReview(req: Request, res: Response, next: NextFunction) {
  try {
    const { external_id, candidate_id, action, reason } = req.body as {
      external_id: string;
      candidate_id: string;
      action: 'shortlist' | 'reject' | 'on_hold' | 'select';
      reason?: string;
    };
    const cardId = await jobsService.getCardIdByExternalId(external_id);
    const candidate = await jobsService.reviewCandidate(
      cardId,
      candidate_id,
      { action, reason },
      SQUADHUB_ADMIN,
    );
    res.json({ success: true, candidate });
  } catch (err) {
    next(err);
  }
}

export async function handleInterviewRounds(req: Request, res: Response, next: NextFunction) {
  try {
    const body = req.body as {
      external_id: string;
      op: 'create' | 'update' | 'cancel';
      round_id?: string;
      round?: Record<string, unknown>;
      candidate_ids?: string[];
    };
    const cardId = await jobsService.getCardIdByExternalId(body.external_id);

    if (body.op === 'create') {
      if (!body.round || !body.candidate_ids?.length) {
        throw new AppError(400, 'round and candidate_ids are required to create a round');
      }
      const round = await interviewsService.createRound(
        cardId,
        { ...(body.round as any), candidate_ids: body.candidate_ids },
        SQUADHUB_ADMIN,
      );
      res.status(201).json({ success: true, round });
      return;
    }

    if (!body.round_id) throw new AppError(400, 'round_id is required');
    if (body.op === 'update') {
      const round = await interviewsService.updateRound(
        body.round_id,
        (body.round ?? {}) as any,
        SQUADHUB_ADMIN,
      );
      res.json({ success: true, round });
      return;
    }
    const round = await interviewsService.cancelRound(body.round_id, SQUADHUB_ADMIN);
    res.json({ success: true, round });
  } catch (err) {
    next(err);
  }
}

export async function handleInterviewActions(req: Request, res: Response, next: NextFunction) {
  try {
    const { round_id, invite_id, action, kind, outcome } = req.body as {
      round_id: string;
      invite_id: string;
      action: 'showed_up' | 'start' | 'no_show' | 'outcome';
      kind?: 'no_show' | 'not_joined';
      outcome?: 'selected' | 'rejected' | 'on_hold';
    };

    if (action === 'showed_up') {
      const invite = await interviewsService.markShowedUp(round_id, invite_id, SQUADHUB_ADMIN);
      res.json({ success: true, invite });
      return;
    }
    if (action === 'start') {
      const invite = await interviewsService.startInterview(round_id, invite_id, SQUADHUB_ADMIN);
      res.json({ success: true, invite });
      return;
    }
    if (action === 'no_show') {
      const result = await interviewsService.markAbsent(
        round_id,
        invite_id,
        kind ?? 'no_show',
        SQUADHUB_ADMIN,
      );
      res.json({ success: true, ...result });
      return;
    }
    if (!outcome) throw new AppError(400, 'outcome is required');
    const invite = await interviewsService.setInterviewOutcome(
      round_id,
      invite_id,
      outcome,
      SQUADHUB_ADMIN,
    );
    res.json({ success: true, invite });
  } catch (err) {
    next(err);
  }
}

export async function handleOffers(req: Request, res: Response, next: NextFunction) {
  try {
    const body = req.body as Record<string, any>;
    const op = body.op as string;

    if (op === 'create') {
      if (!body.external_id) throw new AppError(400, 'external_id is required to create offers');
      const cardId = await jobsService.getCardIdByExternalId(body.external_id as string);
      const result = await offersService.createOffers(
        cardId,
        {
          candidate_ids: body.candidate_ids,
          all_selected: body.all_selected,
          delivery_mode: body.delivery_mode,
          position_title: body.position_title,
          effective_date: body.effective_date,
          join_by_date: body.join_by_date,
          expires_on: body.expires_on,
          compensation: body.compensation,
          squadhub_template_id: body.squadhub_template_id,
        },
        SQUADHUB_ADMIN,
      );
      res.status(201).json({ success: true, ...result });
      return;
    }

    const offerId = body.offer_id as string | undefined;
    if (!offerId) throw new AppError(400, 'offer_id is required');

    switch (op) {
      case 'update': {
        const offer = await offersService.updateOfferPackage(offerId, body as any, SQUADHUB_ADMIN);
        res.json({ success: true, offer });
        return;
      }
      case 'send': {
        const offer = await offersService.sendOffer(offerId, body.letter, SQUADHUB_ADMIN);
        res.json({ success: true, offer });
        return;
      }
      case 'mark_sent_manually': {
        const offer = await offersService.markSentManually(offerId, SQUADHUB_ADMIN);
        res.json({ success: true, offer });
        return;
      }
      case 'accept_negotiation': {
        const offer = await offersService.acceptNegotiation(
          offerId,
          { compensation: body.compensation, note: body.note },
          SQUADHUB_ADMIN,
        );
        res.json({ success: true, offer });
        return;
      }
      case 'decline_negotiation': {
        const offer = await offersService.declineNegotiation(
          offerId,
          { note: body.note },
          SQUADHUB_ADMIN,
        );
        res.json({ success: true, offer });
        return;
      }
      case 'counter': {
        if (!body.compensation) throw new AppError(400, 'compensation is required to counter');
        const offer = await offersService.counterOffer(
          offerId,
          { compensation: body.compensation, note: body.note },
          SQUADHUB_ADMIN,
        );
        res.json({ success: true, offer });
        return;
      }
      case 'withdraw': {
        const offer = await offersService.withdrawOffer(offerId, SQUADHUB_ADMIN);
        res.json({ success: true, offer });
        return;
      }
      case 'answer_question': {
        if (!body.answer) throw new AppError(400, 'answer is required');
        const result = await offersService.answerOfferQuestion(
          offerId,
          body.answer as string,
          SQUADHUB_ADMIN,
        );
        res.json({ success: true, ...result });
        return;
      }
      default:
        throw new AppError(400, `Unknown offer op: ${op}`);
    }
  } catch (err) {
    next(err);
  }
}

export async function handleQuestionAnswer(req: Request, res: Response, next: NextFunction) {
  try {
    const { question_id, answer } = req.body as { question_id: string; answer: string };
    const question = await jobQuestionsService.answerQuestion(question_id, answer, SQUADHUB_ADMIN);
    res.json({ success: true, question });
  } catch (err) {
    next(err);
  }
}

export async function handleQuestionDelete(req: Request, res: Response, next: NextFunction) {
  try {
    const { question_id } = req.body as { question_id: string };
    const result = await jobQuestionsService.deleteQuestion(question_id, SQUADHUB_ADMIN);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function handleHire(req: Request, res: Response, next: NextFunction) {
  try {
    const { external_id, candidate_id, keep_open, joining_date } = req.body as {
      external_id: string;
      candidate_id: string;
      keep_open: boolean;
      joining_date: string;
    };
    const cardId = await jobsService.getCardIdByExternalId(external_id);
    const result = await jobsService.hireCandidate(
      cardId,
      candidate_id,
      { keep_open, joining_date },
      SQUADHUB_ADMIN,
    );
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function handleMarkJoined(req: Request, res: Response, next: NextFunction) {
  try {
    const { external_id, candidate_id } = req.body as {
      external_id: string;
      candidate_id: string;
    };
    const cardId = await jobsService.getCardIdByExternalId(external_id);
    const candidate = await jobsService.markJoined(cardId, candidate_id, SQUADHUB_ADMIN);
    res.json({ success: true, candidate });
  } catch (err) {
    next(err);
  }
}

export async function handleClose(req: Request, res: Response, next: NextFunction) {
  try {
    const { external_id, close_mode } = req.body as {
      external_id: string;
      close_mode: 'filled' | 'cancelled';
    };
    const cardId = await jobsService.getCardIdByExternalId(external_id);
    const result = await jobsService.closeJobCard(cardId, close_mode, SQUADHUB_ADMIN);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}
