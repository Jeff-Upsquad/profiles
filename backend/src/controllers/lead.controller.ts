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
    const { form_type, status, search, page, limit } = req.query;
    const result = await leadService.getLeadSubmissions({
      form_type: form_type as string | undefined,
      status: status as string | undefined,
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
