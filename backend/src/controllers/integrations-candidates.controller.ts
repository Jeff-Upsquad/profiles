import { Request, Response, NextFunction } from 'express';
import * as leadService from '../services/lead.service.js';
import * as interviewService from '../services/interview.service.js';
import * as formConfigService from '../services/form-config.service.js';
import { env } from '../config/env.js';
import { AppError } from '../middleware/errorHandler.middleware.js';

/**
 * Candidate surface for SquadHub's "Candidates" mini app. SquadHub renders a
 * thin UI and proxies every read/write here over the signed
 * /api/integrations/squadhub/* channel (verifySquadhubSecret). All business
 * logic — status automations, talent sync, soft-delete — stays in lead.service,
 * so SquadHub never duplicates it.
 *
 * Writes are authored by SQUADHUB_SERVICE_USER_ID (lead_notes.created_by is NOT
 * NULL). The acting SquadHub user's email rides in X-SquadHub-Actor and is
 * logged so the audit trail records who acted from SquadHub.
 */

function actorOf(req: Request): string | null {
  const raw = req.header('x-squadhub-actor') ?? req.header('X-SquadHub-Actor');
  return typeof raw === 'string' && raw.trim().length > 0 ? raw.trim() : null;
}

/** The uuid we stamp as the author of candidate writes, or 503 if unconfigured. */
function serviceUserId(): string {
  const id = env.SQUADHUB_SERVICE_USER_ID;
  if (!id) {
    throw new AppError(503, 'SquadHub candidate writes are not configured (SQUADHUB_SERVICE_USER_ID unset)');
  }
  return id;
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function listCandidates(req: Request, res: Response, next: NextFunction) {
  try {
    const { form_type, status, profile_type, search, page, limit, role, signed_up, deleted } = req.query;
    const result = await leadService.getLeadSubmissions({
      form_type: form_type as string | undefined,
      status: status as string | undefined,
      profile_type: profile_type as string | undefined,
      search: search as string | undefined,
      role: role as string | undefined,
      signed_up: signed_up as string | undefined,
      deleted: deleted as string | undefined,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * Public candidate forms (the /apply/* lead-capture pages). SquadHub's
 * "Public Forms" panel lists these so an admin can copy/open the live links.
 * We return each form's full public URL, built from this app's own public
 * origin (FRONTEND_URL — the same origin used for password-reset/invite links),
 * so SquadHub never has to know the SquadHire domain.
 */
function publicFormsOrigin(): string {
  const raw =
    process.env.FRONTEND_URL ||
    env.CORS_ORIGIN?.split(',')[0] ||
    'http://localhost:5173';
  return raw.trim().replace(/\/+$/, '');
}

export async function listPublicForms(_req: Request, res: Response, next: NextFunction) {
  try {
    const origin = publicFormsOrigin();
    const forms = await formConfigService.getPublicForms();
    const shaped = (forms ?? []).map((f: any) => {
      const urlPath = String(f.url_path ?? `/apply/${f.form_type}`);
      const normalizedPath = urlPath.startsWith('/') ? urlPath : `/${urlPath}`;
      return {
        form_type: f.form_type,
        title: f.title ?? f.form_type,
        description: f.description ?? '',
        url_path: normalizedPath,
        public_url: `${origin}${normalizedPath}`,
        enabled: !!f.enabled,
      };
    });
    res.json({ forms: shaped });
  } catch (err) {
    next(err);
  }
}

export async function getCandidate(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await leadService.getLeadSubmission(req.params.id as string);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function listCandidateNotes(req: Request, res: Response, next: NextFunction) {
  try {
    const notes = await leadService.listLeadNotes(req.params.id as string);
    res.json({ notes });
  } catch (err) {
    next(err);
  }
}

/**
 * Category resolvers — SquadHub calls these to authorise note/interview writes
 * by the record's REAL category (the note/interview id carries no candidate id
 * on those routes, so the category must be resolved authoritatively here).
 */
export async function getCandidateNoteFormType(req: Request, res: Response, next: NextFunction) {
  try {
    const form_type = await leadService.getLeadNoteFormType(req.params.noteId as string);
    if (!form_type) throw new AppError(404, 'Note not found');
    res.json({ form_type });
  } catch (err) {
    next(err);
  }
}

export async function getInterviewFormType(req: Request, res: Response, next: NextFunction) {
  try {
    const form_type = await interviewService.getInvitationFormType(req.params.id as string);
    if (!form_type) throw new AppError(404, 'Interview not found');
    res.json({ form_type });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Writes (authored by the SquadHub service identity)
// ---------------------------------------------------------------------------

export async function updateCandidateStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = actorOf(req);
    const author = serviceUserId();
    console.log(`[candidates] status change on ${req.params.id} → ${req.body?.status} by SquadHub actor=${actor ?? 'unknown'}`);
    const result = await leadService.updateLeadStatus(
      req.params.id as string,
      req.body,
      author,
      { source: 'admin' }
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function createCandidateNote(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = actorOf(req);
    const author = serviceUserId();
    const content = String(req.body?.content ?? '');
    console.log(`[candidates] note added on ${req.params.id} by SquadHub actor=${actor ?? 'unknown'}`);
    const note = await leadService.createLeadNote(req.params.id as string, content, author);
    res.status(201).json(note);
  } catch (err) {
    next(err);
  }
}

export async function updateCandidateNote(req: Request, res: Response, next: NextFunction) {
  try {
    const note = await leadService.updateLeadNote(req.params.noteId as string, req.body?.content);
    res.json(note);
  } catch (err) {
    next(err);
  }
}

export async function deleteCandidateNote(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await leadService.deleteLeadNote(req.params.noteId as string);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function softDeleteCandidate(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = actorOf(req);
    console.log(`[candidates] soft-delete ${req.params.id} by SquadHub actor=${actor ?? 'unknown'}`);
    const result = await leadService.softDeleteLead(req.params.id as string);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function restoreCandidate(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = actorOf(req);
    console.log(`[candidates] restore ${req.params.id} by SquadHub actor=${actor ?? 'unknown'}`);
    const result = await leadService.restoreLead(req.params.id as string);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Onboarding tab — signed-up candidates with onboarding progress (read-only)
// ---------------------------------------------------------------------------

export async function listOnboarding(req: Request, res: Response, next: NextFunction) {
  try {
    const { form_type, search, page, limit } = req.query;
    const result = await leadService.getOnboardingLeads({
      form_type: form_type as string | undefined,
      search: search as string | undefined,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Interview Responses tab — first-level interview invitations + review toggle
// ---------------------------------------------------------------------------

export async function listInterviews(req: Request, res: Response, next: NextFunction) {
  try {
    const { status, form_type, search, page, limit } = req.query;
    const result = await interviewService.listInterviewInvitations({
      status: (status as 'submitted' | 'pending' | 'expired' | 'all') || undefined,
      form_type: form_type as string | undefined,
      search: search as string | undefined,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function setInterviewReviewed(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = actorOf(req);
    const reviewed = req.body?.reviewed !== false;
    console.log(`[candidates] interview ${req.params.id} reviewed=${reviewed} by SquadHub actor=${actor ?? 'unknown'}`);
    // reviewed_by is nullable — stamp the service identity when configured.
    const result = await interviewService.setInvitationReviewed(
      req.params.id as string,
      reviewed,
      env.SQUADHUB_SERVICE_USER_ID,
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
}
