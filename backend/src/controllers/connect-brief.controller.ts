import { Request, Response, NextFunction } from 'express';
import * as squadhubLeads from '../services/squadhub-leads.service.js';
import * as businessService from '../services/business.service.js';
import * as storageService from '../services/storage.service.js';
import { AppError } from '../middleware/errorHandler.middleware.js';
import type { ConnectBriefInput } from '../validators/connect-brief.validators.js';

// POST /api/business/connect-brief/voice-upload-url — presigned R2 PUT URL for
// the brief form's requirement voice note. The browser uploads the blob
// directly, then sends the returned fileUrl back as requirement_voice_url.
export async function getVoiceUploadUrl(req: Request, res: Response, next: NextFunction) {
  try {
    // MediaRecorder emits parameterised MIMEs (`audio/webm;codecs=opus`).
    // Strip params so the base type is what R2 signs the presigned PUT against.
    const contentType = String((req.body?.content_type ?? ''))
      .trim()
      .split(';')[0]
      .trim();
    if (!/^audio\/[a-z0-9.+-]+$/i.test(contentType)) {
      throw new AppError(400, 'content_type must be an audio MIME type');
    }
    const fileName = String(req.body?.filename ?? 'voice-note.webm').slice(0, 200);
    const { uploadUrl, fileUrl } = await storageService.getPresignedUploadUrl({
      userId: req.user!.id,
      fileName,
      contentType,
      folder: 'brief-voice',
    });
    res.json({ success: true, data: { upload_url: uploadUrl, public_url: fileUrl } });
  } catch (err) {
    next(err);
  }
}

// GET /api/business/connect-brief/countries — proxied country list for the
// brief form's country picker.
export async function getCountries(_req: Request, res: Response, next: NextFunction) {
  try {
    const countries = await squadhubLeads.listCountries();
    res.json({ success: true, data: countries });
  } catch (err) {
    next(err);
  }
}

// POST /api/business/connect-brief — assemble the lead payload and forward it
// to squadhub-web. Contact details default to the signed-in business account,
// so the client never has to send (or be trusted for) them.
export async function submitBrief(req: Request, res: Response, next: NextFunction) {
  try {
    const body = req.body as ConnectBriefInput;
    const account = await businessService.getBusinessUser(req.user!.id).catch(() => null);

    // Prefer account contact details; allow form values when the account is missing them.
    const contact_name = body.contact_name?.trim() || account?.contact_person_name?.trim() || '';
    const email =
      account?.contact_email?.trim() ||
      body.email?.trim() ||
      req.user!.email ||
      '';
    const phone = account?.contact_phone?.trim() || body.phone?.trim() || '';

    if (!contact_name) throw new AppError(400, 'A contact name is required.');
    if (!email) throw new AppError(400, 'A contact email is required.');
    if (!phone) throw new AppError(400, 'A contact phone number is required.');

    const brandName = body.brand_name.trim();
    const businessNature = body.business_nature.trim();
    const businessNote = body.business_note.trim();
    const location = body.business_location?.trim() || '';

    const payload: Record<string, unknown> = {
      service_types: body.service_types,
      brand_name: brandName,
      business_nature: businessNature,
      business_note: businessNote,
      contact_name,
      email,
      phone,
      // Location is opt-in — only send state_regions when a country is chosen.
      state_regions: body.country_id ? body.state_regions : [],
      languages: body.languages,
      // Assignments don't use working days upstream — send none.
      working_days: body.card_type === 'assignment' ? [] : body.working_days,
      card_type: body.card_type,
    };
    if (body.country_id) payload.country_id = body.country_id;
    if (location) payload.business_location = location;
    if (body.requirement_voice_url) payload.requirement_voice_url = body.requirement_voice_url;
    if (body.role_requirements && Object.keys(body.role_requirements).length > 0) {
      payload.role_requirements = body.role_requirements;
    }

    const result = await squadhubLeads.submitLandingBrief(payload);

    // Persist brand (+ any newly provided contact) onto the business account
    // so later briefs / settings prefill. Non-fatal — the lead already landed.
    try {
      const profileUpdate: {
        company_name: string;
        industry: string;
        business_note: string;
        business_location: string;
        contact_email?: string;
        contact_phone?: string;
      } = {
        company_name: brandName,
        industry: businessNature,
        business_note: businessNote,
        business_location: location,
      };
      if (!account?.contact_email?.trim() && email) profileUpdate.contact_email = email;
      if (!account?.contact_phone?.trim() && phone) profileUpdate.contact_phone = phone;
      await businessService.updateBusinessUser(req.user!.id, profileUpdate);
    } catch {
      /* ignore profile sync failures */
    }

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}
