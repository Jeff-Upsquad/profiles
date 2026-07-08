import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.middleware.js';
import { emitJobsEvent } from './jobs-outbox.service.js';
import { createBusinessNotification } from './business-notifications.service.js';
import { notifyJobEvent } from './push.service.js';
import {
  assertTalentCanViewJobProfile,
  getCardRefs,
  getTalentNames,
  notifyTalentsInApp,
  shouldEmitOutbox,
  type JobsActor,
} from './jobs.service.js';

/**
 * Candidate Q&A on job profiles (00102).
 *
 * Semantics (contract §7): answered ⇒ published — there is no separate
 * publish flag. Visibility is service-enforced: an unanswered question is
 * visible only to the asker (and the business/admin); once answered it shows
 * on the job profile for every viewer. Delete = soft tombstone (deleted_at),
 * which survives event replays.
 */

const QUESTION_FIELDS =
  'id, job_profile_id, card_id, talent_user_id, question, answer, answered_by, answered_at, deleted_at, created_at';

async function getQuestion(questionId: string) {
  const { data, error } = await supabaseAdmin
    .from('job_questions')
    .select(QUESTION_FIELDS)
    .eq('id', questionId)
    .maybeSingle();
  if (error) throw new AppError(500, error.message);
  if (!data) throw new AppError(404, 'Question not found');
  return data as Record<string, any>;
}

async function getProfileRefs(jobProfileId: string) {
  const { data, error } = await supabaseAdmin
    .from('job_profiles')
    .select('id, external_id, title, business_user_id')
    .eq('id', jobProfileId)
    .maybeSingle();
  if (error) throw new AppError(500, error.message);
  if (!data) throw new AppError(404, 'Job profile not found');
  return data as Record<string, any>;
}

// ─── Talent ────────────────────────────────────────────────────────────────

export async function askQuestion(
  talentUserId: string,
  jobProfileId: string,
  input: { question: string; card_id?: string },
) {
  await assertTalentCanViewJobProfile(talentUserId, jobProfileId);
  const profile = await getProfileRefs(jobProfileId);

  const { data: question, error } = await supabaseAdmin
    .from('job_questions')
    .insert({
      job_profile_id: jobProfileId,
      card_id: input.card_id ?? null,
      talent_user_id: talentUserId,
      question: input.question,
    })
    .select(QUESTION_FIELDS)
    .single();
  if (error || !question) throw new AppError(500, error?.message ?? 'Failed to save question');

  const names = await getTalentNames([talentUserId]);
  if (profile.business_user_id) {
    await createBusinessNotification({
      businessUserId: profile.business_user_id as string,
      type: 'job_question_asked',
      title: `${names.get(talentUserId) ?? 'A candidate'} asked a question on ${profile.title}`,
      body: input.question,
      ref: { job_profile_id: jobProfileId, question_id: (question as any).id, route: 'jobs' },
    });
  }

  // SquadHub's events dispatcher routes by the card's external_id (the
  // envelope requires it) — resolve it from the asking context. The ask flow
  // is recipient-gated, so a card is normally always present.
  if (input.card_id) {
    const refs = await getCardRefs(input.card_id);
    await emitJobsEvent('job_question_asked', {
      external_id: refs.externalId,
      job_profile_external_id: (profile.external_id as string) ?? null,
      actor: { type: 'talent', id: talentUserId },
      data: {
        question_id: (question as any).id,
        question: input.question,
        talent_user_id: talentUserId,
        talent_name: names.get(talentUserId) ?? null,
        card_id: input.card_id,
      },
    });
  } else {
    console.warn('[job-questions] question asked without card context — not mirrored to SquadHub');
  }

  return question;
}

/** Published Q&A + the talent's own unanswered questions. */
export async function listQuestionsForTalent(jobProfileId: string, talentUserId: string) {
  const { data, error } = await supabaseAdmin
    .from('job_questions')
    .select(QUESTION_FIELDS)
    .eq('job_profile_id', jobProfileId)
    .is('deleted_at', null)
    .or(`answered_at.not.is.null,talent_user_id.eq.${talentUserId}`)
    .order('created_at', { ascending: false });
  if (error) throw new AppError(500, error.message);

  const rows = data ?? [];
  const names = await getTalentNames(rows.map((r: any) => r.talent_user_id as string));
  return rows.map((r: any) => ({
    id: r.id,
    question: r.question,
    answer: r.answer,
    answered_at: r.answered_at,
    is_published: r.answered_at != null,
    is_mine: r.talent_user_id === talentUserId,
    asker_name: names.get(r.talent_user_id) ?? null,
    created_at: r.created_at,
  }));
}

// ─── Business / admin ──────────────────────────────────────────────────────

export async function listQuestionsForBusiness(jobProfileId: string) {
  const { data, error } = await supabaseAdmin
    .from('job_questions')
    .select(QUESTION_FIELDS)
    .eq('job_profile_id', jobProfileId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (error) throw new AppError(500, error.message);

  const rows = data ?? [];
  const names = await getTalentNames(rows.map((r: any) => r.talent_user_id as string));
  return rows.map((r: any) => ({ ...r, asker_name: names.get(r.talent_user_id) ?? null }));
}

export async function answerQuestion(questionId: string, answer: string, actor: JobsActor) {
  const question = await getQuestion(questionId);
  if (question.deleted_at) throw new AppError(409, 'Question has been deleted');

  const { data: updated, error } = await supabaseAdmin
    .from('job_questions')
    .update({
      answer,
      answered_by: actor.type === 'admin' ? 'admin' : 'business',
      answered_by_id: actor.id ?? null,
      answered_at: new Date().toISOString(), // answered ⇒ published
    })
    .eq('id', questionId)
    .select(QUESTION_FIELDS)
    .single();
  if (error || !updated) throw new AppError(500, error?.message ?? 'Failed to answer question');

  const profile = await getProfileRefs(question.job_profile_id as string);
  notifyTalentsInApp(
    [question.talent_user_id as string],
    'job_question_answered',
    'Your question was answered',
    `Your question about ${profile.title} was answered.\nQ: ${question.question}\nA: ${answer}`,
    `/talent/job-openings/profiles/${question.job_profile_id}`,
  ).catch(() => {});
  if (question.card_id) {
    notifyJobEvent([question.talent_user_id as string], {
      type: 'job_stage',
      title: 'Your question was answered',
      body: `Your question about ${profile.title} has an answer.`,
      cardId: question.card_id as string,
    }).catch((err) => console.error('[job-questions] answer push threw', err));
  }

  if (shouldEmitOutbox(actor) && question.card_id) {
    const refs = await getCardRefs(question.card_id as string);
    await emitJobsEvent('job_question_answered', {
      external_id: refs.externalId,
      job_profile_external_id: (profile.external_id as string) ?? null,
      actor,
      data: { question_id: questionId, answer },
    });
  }

  return updated;
}

export async function deleteQuestion(questionId: string, actor: JobsActor) {
  const question = await getQuestion(questionId);
  if (question.deleted_at) return { deleted: true };

  const { error } = await supabaseAdmin
    .from('job_questions')
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: actor.type === 'admin' ? 'admin' : 'business',
    })
    .eq('id', questionId);
  if (error) throw new AppError(500, error.message);

  if (shouldEmitOutbox(actor) && question.card_id) {
    const profile = await getProfileRefs(question.job_profile_id as string);
    const refs = await getCardRefs(question.card_id as string);
    await emitJobsEvent(
      'job_question_deleted',
      {
        external_id: refs.externalId,
        job_profile_external_id: (profile.external_id as string) ?? null,
        actor,
        data: { question_id: questionId },
      },
      `job_question_deleted:${questionId}`,
    );
  }

  return { deleted: true };
}

/** Ownership guard: the question's job profile must belong to this business. */
export async function assertQuestionBelongsToBusiness(
  questionId: string,
  businessUserId: string,
): Promise<void> {
  const question = await getQuestion(questionId);
  const profile = await getProfileRefs(question.job_profile_id as string);
  if (profile.business_user_id !== businessUserId) {
    throw new AppError(403, 'This question does not belong to your business');
  }
}
