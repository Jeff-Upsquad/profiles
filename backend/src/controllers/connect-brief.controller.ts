import { Request, Response, NextFunction } from 'express';
import * as squadhubLeads from '../services/squadhub-leads.service.js';
import * as businessService from '../services/business.service.js';
import { AppError } from '../middleware/errorHandler.middleware.js';
import type { ConnectBriefInput } from '../validators/connect-brief.validators.js';

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

    const contact_name = body.contact_name?.trim() || account?.contact_person_name?.trim() || '';
    const email = body.email?.trim() || account?.contact_email?.trim() || req.user!.email || '';
    const phone = body.phone?.trim() || account?.contact_phone?.trim() || '';

    if (!contact_name) throw new AppError(400, 'A contact name is required.');
    if (!email) throw new AppError(400, 'A contact email is required.');
    if (!phone) throw new AppError(400, 'A contact phone number is required.');

    const payload: Record<string, unknown> = {
      service_types: body.service_types,
      brand_name: body.brand_name.trim(),
      business_nature: body.business_nature.trim(),
      business_note: body.business_note.trim(),
      contact_name,
      email,
      phone,
      country_id: body.country_id,
      state_regions: body.state_regions,
      languages: body.languages,
      // Assignments don't use working days upstream — send none.
      working_days: body.card_type === 'assignment' ? [] : body.working_days,
      card_type: body.card_type,
    };
    const location = body.business_location?.trim();
    if (location) payload.business_location = location;
    if (body.role_requirements && Object.keys(body.role_requirements).length > 0) {
      payload.role_requirements = body.role_requirements;
    }

    const result = await squadhubLeads.submitLandingBrief(payload);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}
