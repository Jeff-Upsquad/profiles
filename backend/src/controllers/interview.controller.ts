import { Request, Response, NextFunction } from 'express';
import * as interviewService from '../services/interview.service.js';

// ---------------------------------------------------------------------------
// Public — token-based
// ---------------------------------------------------------------------------

export async function getByToken(req: Request, res: Response, next: NextFunction) {
  try {
    const { token } = req.params as { token: string };
    const result = await interviewService.getInvitationByToken(token);
    // Do not expose internal invitation fields (id, created_by, raw responses) to the public.
    res.json({
      lead: result.lead,
      form_type: result.form_type,
      questions: result.questions.map((q: any) => ({
        id: q.id,
        question_text: q.question_text,
        helper_text: q.helper_text,
        field_type: q.field_type,
        options: q.options,
        is_required: q.is_required,
        display_order: q.display_order,
      })),
      status: result.status,
      expires_at: result.invitation.expires_at,
      submitted_at: result.invitation.submitted_at,
    });
  } catch (err) {
    next(err);
  }
}

export async function submitByToken(req: Request, res: Response, next: NextFunction) {
  try {
    const { token } = req.params as { token: string };
    await interviewService.submitInterviewResponses(token, req.body);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Admin — questions CRUD
// ---------------------------------------------------------------------------

export async function listQuestions(req: Request, res: Response, next: NextFunction) {
  try {
    const formType = req.query.form_type as string;
    if (!formType) {
      res.status(400).json({ error: 'form_type query parameter is required' });
      return;
    }
    const data = await interviewService.listInterviewQuestions(formType, true);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function createQuestion(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await interviewService.createInterviewQuestion(req.body);
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
}

export async function updateQuestion(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await interviewService.updateInterviewQuestion(
      req.params.id as string,
      req.body
    );
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function deleteQuestion(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await interviewService.deleteInterviewQuestion(req.params.id as string);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function reorderQuestions(req: Request, res: Response, next: NextFunction) {
  try {
    const { form_type, order } = req.body;
    const data = await interviewService.reorderInterviewQuestions(form_type, order);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Admin — list invitations across leads
// ---------------------------------------------------------------------------

export async function setInvitationReviewed(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const reviewed = req.body?.reviewed !== false;
    const adminUserId = (req as any).user?.id;
    const result = await interviewService.setInvitationReviewed(id, reviewed, adminUserId);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function listInvitations(req: Request, res: Response, next: NextFunction) {
  try {
    const { status, form_type, search, page, limit } = req.query;
    const result = await interviewService.listInterviewInvitations({
      status: (status as any) || undefined,
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
// Admin — per-lead invitations
// ---------------------------------------------------------------------------

function buildShareMessage(leadName: string, url: string) {
  return (
    `Hi ${leadName},\n\n` +
    `Thanks for your interest in joining Upsquad. Please answer a few quick questions so we can move to the next step:\n\n` +
    `${url}\n\n` +
    `This link is valid for 7 days.\n` +
    `Know more about us: https://www.upsquadconnect.com`
  );
}

export async function createInvitation(req: Request, res: Response, next: NextFunction) {
  try {
    const leadId = req.params.leadId as string;
    const adminUserId = (req as any).user?.id;
    const { invitation, lead } = await interviewService.createInvitation(leadId, adminUserId);

    const origin =
      (req.headers['x-forwarded-origin'] as string) ||
      (req.headers.origin as string) ||
      `${req.protocol}://${req.get('host')}`;
    const url = `${origin}/apply/interview/${invitation.token}`;

    res.status(201).json({
      invitation,
      url,
      share_message: buildShareMessage(lead.name, url),
    });
  } catch (err) {
    next(err);
  }
}

export async function getInvitation(req: Request, res: Response, next: NextFunction) {
  try {
    const leadId = req.params.leadId as string;
    const invitation = await interviewService.getLatestInvitationForLead(leadId);
    if (!invitation) {
      res.json({ invitation: null });
      return;
    }
    const origin =
      (req.headers['x-forwarded-origin'] as string) ||
      (req.headers.origin as string) ||
      `${req.protocol}://${req.get('host')}`;
    const url = `${origin}/apply/interview/${invitation.token}`;
    res.json({ invitation, url });
  } catch (err) {
    next(err);
  }
}
