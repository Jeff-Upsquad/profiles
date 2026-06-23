import { Request, Response, NextFunction } from 'express';
import * as leadService from '../services/lead.service.js';
import * as storageService from '../services/storage.service.js';

// ---------------------------------------------------------------------------
// Public
// ---------------------------------------------------------------------------

export async function submitLead(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await leadService.createLeadSubmission(req.body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function checkExisting(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await leadService.checkContactExists(req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getUploadUrl(req: Request, res: Response, next: NextFunction) {
  try {
    const { filename, content_type } = req.body;
    if (!filename || !content_type) {
      res.status(400).json({ error: 'filename and content_type are required' });
      return;
    }
    const result = await storageService.getPresignedUploadUrl({
      userId: 'lead-applicant',
      fileName: filename,
      contentType: content_type,
      folder: 'lead-resumes',
    });
    res.json({
      upload_url: result.uploadUrl,
      file_url: result.fileUrl,
    });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export async function getLeads(req: Request, res: Response, next: NextFunction) {
  try {
    const { form_type, status, profile_type, search, page, limit, role, signed_up, deleted, form_data_filter } = req.query;
    let parsedFormDataFilter: leadService.FormDataFilterRule[] | undefined;
    if (typeof form_data_filter === 'string' && form_data_filter.length > 0) {
      try {
        const arr = JSON.parse(form_data_filter);
        if (Array.isArray(arr)) parsedFormDataFilter = arr as leadService.FormDataFilterRule[];
      } catch {
        // Malformed JSON — silently ignore so we don't 500 the list.
      }
    }
    const result = await leadService.getLeadSubmissions({
      form_type: form_type as string | undefined,
      form_types: req.candidateCategoryFilter,
      status: status as string | undefined,
      profile_type: profile_type as string | undefined,
      search: search as string | undefined,
      role: role as string | undefined,
      signed_up: signed_up as string | undefined,
      deleted: deleted as string | undefined,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      form_data_filter: parsedFormDataFilter,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getLeadFormFields(req: Request, res: Response, next: NextFunction) {
  try {
    const formType = (req.query.form_type as string | undefined) || undefined;
    const fields = await leadService.getLeadFormFields(formType);
    res.json({ fields });
  } catch (err) {
    next(err);
  }
}

export async function getOnboardingLeads(req: Request, res: Response, next: NextFunction) {
  try {
    const { form_type, search, page, limit } = req.query;
    const result = await leadService.getOnboardingLeads({
      form_type: form_type as string | undefined,
      form_types: req.candidateCategoryFilter,
      search: search as string | undefined,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getLead(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await leadService.getLeadSubmission(req.params.id as string);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function updateLeadStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await leadService.updateLeadStatus(
      req.params.id as string,
      req.body,
      (req as any).user.id
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function updateLeadProfileType(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await leadService.updateLeadProfileType(
      req.params.id as string,
      req.body
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Notes (admin)
// ---------------------------------------------------------------------------

export async function listLeadNotes(req: Request, res: Response, next: NextFunction) {
  try {
    const notes = await leadService.listLeadNotes(req.params.id as string);
    res.json({ notes });
  } catch (err) {
    next(err);
  }
}

export async function createLeadNote(req: Request, res: Response, next: NextFunction) {
  try {
    const note = await leadService.createLeadNote(
      req.params.id as string,
      req.body.content,
      (req as any).user.id
    );
    res.status(201).json(note);
  } catch (err) {
    next(err);
  }
}

export async function updateLeadNote(req: Request, res: Response, next: NextFunction) {
  try {
    const note = await leadService.updateLeadNote(
      req.params.noteId as string,
      req.body.content
    );
    res.json(note);
  } catch (err) {
    next(err);
  }
}

export async function deleteLeadNote(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await leadService.deleteLeadNote(req.params.noteId as string);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function softDeleteLead(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await leadService.softDeleteLead(req.params.id as string);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function restoreLead(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await leadService.restoreLead(req.params.id as string);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function permanentlyDeleteLead(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await leadService.permanentlyDeleteLead(req.params.id as string);
    res.json(result);
  } catch (err) {
    next(err);
  }
}
