import { Request, Response, NextFunction } from 'express';
import * as formConfigService from '../services/form-config.service.js';

// Admin — list all forms
export async function getPublicForms(_req: Request, res: Response, next: NextFunction) {
  try {
    const forms = await formConfigService.getPublicForms();
    res.json(forms);
  } catch (err) {
    next(err);
  }
}

// Admin — toggle enabled/disabled
export async function toggleFormEnabled(req: Request, res: Response, next: NextFunction) {
  try {
    const { enabled } = req.body;
    const form = await formConfigService.toggleFormEnabled(req.params.id as string, enabled);
    res.json(form);
  } catch (err) {
    next(err);
  }
}

// Admin — get auto-approval rules
export async function getAutoApprovalRules(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await formConfigService.getAutoApprovalRules(req.params.id as string);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

// Admin — update auto-approval rules
export async function updateAutoApprovalRules(req: Request, res: Response, next: NextFunction) {
  try {
    const form = await formConfigService.updateAutoApprovalRules(req.params.id as string, req.body);
    res.json(form);
  } catch (err) {
    next(err);
  }
}

// Public — check if a specific form is enabled
export async function checkFormStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const enabled = await formConfigService.isFormEnabled(req.params.formType as string);
    res.json({ enabled });
  } catch (err) {
    next(err);
  }
}
