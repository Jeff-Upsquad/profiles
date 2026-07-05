import { Request, Response, NextFunction } from 'express';
import * as adminService from '../services/admin.service.js';
import * as inviteService from '../services/invite.service.js';

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export async function getDashboardStats(_req: Request, res: Response, next: NextFunction) {
  try {
    const result = await adminService.getDashboardStats();
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export async function getCategories(_req: Request, res: Response, next: NextFunction) {
  try {
    const result = await adminService.getCategories();
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function createCategory(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await adminService.createCategory(req.body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function updateCategory(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await adminService.updateCategory(req.params.id as string, req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function archiveCategory(req: Request, res: Response, next: NextFunction) {
  try {
    const { is_active } = req.body;
    const result = await adminService.archiveCategory(req.params.id as string, is_active ?? false);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Category Fields
// ---------------------------------------------------------------------------

export async function getCategoryFields(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await adminService.getCategoryFields(req.params.id as string);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function createField(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await adminService.createField(req.params.id as string, req.body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function updateField(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await adminService.updateField(req.params.fieldId as string, req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function deleteField(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await adminService.deleteField(req.params.fieldId as string);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function reorderFields(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await adminService.reorderFields(req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Field Options
// ---------------------------------------------------------------------------

export async function getFieldOptions(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await adminService.getFieldOptions(req.params.fieldId as string);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function createOption(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await adminService.createOption(req.params.fieldId as string, req.body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function updateOption(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await adminService.updateOption(req.params.optId as string, req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function deleteOption(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await adminService.deleteOption(req.params.optId as string);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function reorderOptions(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await adminService.reorderOptions(req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Profile Reviews
// ---------------------------------------------------------------------------

export async function getReviewQueue(req: Request, res: Response, next: NextFunction) {
  try {
    const categoryId = req.query.category_id as string | undefined;
    const result = await adminService.getReviewQueue(categoryId);
    res.json({ profiles: result });
  } catch (err) {
    next(err);
  }
}

export async function getReviewProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await adminService.getReviewProfile(req.params.profileId as string);
    res.json({ profile: result });
  } catch (err) {
    next(err);
  }
}

export async function approveProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await adminService.approveProfile(req.params.profileId as string, req.user!.id);
    res.json({ profile: result });
  } catch (err) {
    next(err);
  }
}

export async function rejectProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const { reason } = req.body;
    if (!reason) {
      res.status(400).json({ message: 'Rejection reason is required' });
      return;
    }
    const result = await adminService.rejectProfile(req.params.profileId as string, req.user!.id, reason);
    res.json({ profile: result });
  } catch (err) {
    next(err);
  }
}

export async function bulkApproveProfiles(req: Request, res: Response, next: NextFunction) {
  try {
    const { profile_ids } = req.body;
    const result = await adminService.bulkApproveProfiles(profile_ids, req.user!.id);
    res.json({ results: result });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// User Approvals
// ---------------------------------------------------------------------------

export async function getPendingApprovals(_req: Request, res: Response, next: NextFunction) {
  try {
    const result = await adminService.getPendingApprovals();
    res.json({ users: result });
  } catch (err) {
    next(err);
  }
}

export async function approveUser(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await adminService.approveUser(req.params.userId as string, req.user!.id);
    res.json({ user: result });
  } catch (err) {
    next(err);
  }
}

export async function rejectUser(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await adminService.rejectUser(req.params.userId as string, req.user!.id);
    res.json({ user: result });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Auto-approve setting
// ---------------------------------------------------------------------------

export async function getAutoApproveSetting(_req: Request, res: Response, next: NextFunction) {
  try {
    const value = await adminService.getAdminSetting<boolean>('auto_approve_signups');
    res.json({ enabled: value === true });
  } catch (err) {
    next(err);
  }
}

export async function setAutoApproveSetting(req: Request, res: Response, next: NextFunction) {
  try {
    const enabled = req.body?.enabled === true;
    const adminId = req.user!.id;

    await adminService.setAdminSetting('auto_approve_signups', enabled, adminId);

    let approvedCount = 0;
    if (enabled) {
      const result = await adminService.bulkApprovePendingUsers(adminId);
      approvedCount = result.approvedCount;
    }

    res.json({ enabled, approvedCount });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Template Skill Sets & Tools
// ---------------------------------------------------------------------------

export async function getTemplateSkills(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await adminService.getTemplateSkills(req.params.categoryId as string);
    res.json({ skills: result });
  } catch (err) {
    next(err);
  }
}

export async function createTemplateSkill(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await adminService.createTemplateSkill(req.params.categoryId as string, req.body.name);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function updateTemplateSkill(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await adminService.updateTemplateSkill(req.params.skillId as string, req.body.name);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function deleteTemplateSkill(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await adminService.deleteTemplateSkill(req.params.skillId as string);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getTemplateTools(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await adminService.getTemplateTools(req.params.categoryId as string);
    res.json({ tools: result });
  } catch (err) {
    next(err);
  }
}

export async function createTemplateTool(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await adminService.createTemplateTool(
      req.params.categoryId as string,
      req.body.name,
      req.body.group ?? null,
    );
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function updateTemplateTool(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await adminService.updateTemplateTool(
      req.params.toolId as string,
      req.body.name,
      req.body.group,
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function deleteTemplateTool(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await adminService.deleteTemplateTool(req.params.toolId as string);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Template AI Tools
// ---------------------------------------------------------------------------

export async function getTemplateAiTools(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await adminService.getTemplateAiTools(req.params.categoryId as string);
    res.json({ ai_tools: result });
  } catch (err) {
    next(err);
  }
}

export async function createTemplateAiTool(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await adminService.createTemplateAiTool(req.params.categoryId as string, req.body.name);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function updateTemplateAiTool(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await adminService.updateTemplateAiTool(req.params.toolId as string, req.body.name);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function deleteTemplateAiTool(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await adminService.deleteTemplateAiTool(req.params.toolId as string);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Template Portfolio Categories
// ---------------------------------------------------------------------------

export async function getTemplateCategories(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await adminService.getTemplateCategories(req.params.categoryId as string);
    res.json({ portfolio_categories: result });
  } catch (err) {
    next(err);
  }
}

export async function createTemplateCategory(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await adminService.createTemplateCategory(
      req.params.categoryId as string,
      req.body.name,
    );
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function updateTemplateCategory(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await adminService.updateTemplateCategory(
      req.params.id as string,
      req.body.name,
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function deleteTemplateCategory(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await adminService.deleteTemplateCategory(req.params.id as string);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Talents Module
// ---------------------------------------------------------------------------

const VALID_EMPLOYMENT_TYPES = new Set(['salary', 'freelance', 'partner_program']);

function pickEmploymentType(req: Request): string | undefined {
  const raw = req.query.employment_type as string | undefined;
  return raw && VALID_EMPLOYMENT_TYPES.has(raw) ? raw : undefined;
}

export async function getTalentCategories(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await adminService.getTalentCategories(pickEmploymentType(req));
    res.json({ categories: result });
  } catch (err) {
    next(err);
  }
}

export async function getTalentProfilesByCategory(req: Request, res: Response, next: NextFunction) {
  try {
    const search = req.query.search as string | undefined;
    const result = await adminService.getTalentProfilesByCategory(
      req.params.categoryId as string,
      search,
      pickEmploymentType(req),
    );
    res.json({ profiles: result });
  } catch (err) {
    next(err);
  }
}

export async function getTalentProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await adminService.getTalentProfile(req.params.profileId as string);
    res.json({ profile: result });
  } catch (err) {
    next(err);
  }
}

export async function softDeleteTalentProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await adminService.adminSoftDeleteProfile(req.params.profileId as string);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function updateTalentUser(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await adminService.adminUpdateTalentUser(
      req.params.userId as string,
      req.body,
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function updateUserBasicProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await adminService.adminUpdateBasicProfile(
      req.params.userId as string,
      req.body,
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function updateTalentProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await adminService.adminUpdateTalentProfile(
      req.params.profileId as string,
      req.body,
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getProfilePortfolio(req: Request, res: Response, next: NextFunction) {
  try {
    const items = await adminService.adminGetPortfolioItems(req.params.profileId as string);
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

export async function addProfilePortfolio(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await adminService.adminAddPortfolioItem(
      req.params.profileId as string,
      req.body,
    );
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function reviewProfilePortfolio(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await adminService.adminReviewPortfolioItem(
      req.params.profileId as string,
      req.params.itemId as string,
      req.body,
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function deleteProfilePortfolio(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await adminService.adminDeletePortfolioItem(
      req.params.profileId as string,
      req.params.itemId as string,
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// User Management
// ---------------------------------------------------------------------------

export async function getTalentUsers(_req: Request, res: Response, next: NextFunction) {
  try {
    const result = await adminService.getTalentUsers();
    res.json({ users: result });
  } catch (err) {
    next(err);
  }
}

export async function getBusinessUsers(_req: Request, res: Response, next: NextFunction) {
  try {
    const result = await adminService.getBusinessUsers();
    res.json({ users: result });
  } catch (err) {
    next(err);
  }
}

export async function extendBusinessAccess(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await adminService.extendBusinessAccess(
      req.params.businessId as string,
      { days: req.body.days, expiresAt: req.body.expiresAt }
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getUserDetail(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await adminService.getUserDetail(req.params.userId as string);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function searchUsers(req: Request, res: Response, next: NextFunction) {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q : '';
    const result = await adminService.searchUsers(q);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function suspendUser(req: Request, res: Response, next: NextFunction) {
  try {
    const { suspend, reason } = req.body;
    const result = await adminService.suspendUser(
      req.params.id as string,
      suspend ?? true,
      typeof reason === 'string' ? reason : null,
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function blacklistUser(req: Request, res: Response, next: NextFunction) {
  try {
    const { blacklist, reason } = req.body;
    const result = await adminService.blacklistUser(
      req.params.id as string,
      blacklist ?? true,
      typeof reason === 'string' ? reason : null,
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function setProfileActive(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await adminService.setProfileActive(
      req.params.profileId as string,
      Boolean(req.body.is_active),
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function setProfileTier(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await adminService.setProfileTier(
      req.params.profileId as string,
      req.body.tier ?? null,
      req.body.tier_custom ?? null,
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function setTalentUserActive(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await adminService.setTalentUserActive(
      req.params.id as string,
      Boolean(req.body.is_active),
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function setTalentOnboardingBypass(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const result = await adminService.setTalentOnboardingBypass(
      req.params.id as string,
      Boolean(req.body.skip_onboarding),
      req.body.reason ?? null,
      req.user?.id ?? null,
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function deleteUser(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await adminService.deleteUser(req.params.id as string);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function resetUserPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await adminService.resetUserPassword(req.params.id as string);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Invitations
// ---------------------------------------------------------------------------

export async function createInvitation(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await inviteService.createInvitation({
      ...req.body,
      adminId: req.user!.id,
    });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function getInvitations(req: Request, res: Response, next: NextFunction) {
  try {
    const filters = {
      role: req.query.role as string | undefined,
      status: req.query.status as string | undefined,
      email: req.query.email as string | undefined,
    };
    const result = await inviteService.getInvitations(filters);
    res.json({ invitations: result });
  } catch (err) {
    next(err);
  }
}

export async function revokeInvitation(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await inviteService.revokeInvitation(req.params.id as string);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Business Subscriptions (Category Assignments)
// ---------------------------------------------------------------------------

export async function getBusinessSubscriptions(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await adminService.getBusinessSubscriptions(req.params.businessId as string);
    res.json({ subscriptions: result });
  } catch (err) {
    next(err);
  }
}

export async function assignCategories(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await adminService.assignCategories(
      req.params.businessId as string,
      req.body.category_ids,
      req.user!.id
    );
    res.json({ subscriptions: result });
  } catch (err) {
    next(err);
  }
}

export async function removeCategory(req: Request, res: Response, next: NextFunction) {
  try {
    await adminService.removeCategory(
      req.params.businessId as string,
      req.params.categoryId as string
    );
    res.json({ message: 'Category removed' });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Business Shared Profiles
// ---------------------------------------------------------------------------

export async function getBusinessSharedProfiles(req: Request, res: Response, next: NextFunction) {
  try {
    const categoryId = req.query.category_id as string | undefined;
    const result = await adminService.getBusinessSharedProfiles(
      req.params.businessId as string,
      categoryId
    );
    res.json({ shared_profiles: result });
  } catch (err) {
    next(err);
  }
}

export async function shareProfiles(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await adminService.shareProfiles(
      req.params.businessId as string,
      req.body.profile_ids,
      req.body.category_id,
      req.user!.id
    );
    res.json({ shared_profiles: result });
  } catch (err) {
    next(err);
  }
}

export async function unshareProfile(req: Request, res: Response, next: NextFunction) {
  try {
    await adminService.unshareProfile(
      req.params.businessId as string,
      req.params.profileId as string
    );
    res.json({ message: 'Profile unshared' });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Recycle Bin
// ---------------------------------------------------------------------------

export async function getRecycleBin(_req: Request, res: Response, next: NextFunction) {
  try {
    const result = await adminService.getRecycleBin();
    res.json({ profiles: result });
  } catch (err) {
    next(err);
  }
}

export async function restoreProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const replaceProfileId = req.body?.replace_profile_id as string | undefined;
    const result = await adminService.restoreProfile(req.params.profileId as string, replaceProfileId);
    if ((result as any).conflict) {
      res.status(409).json(result);
      return;
    }
    res.json({ profile: result });
  } catch (err) {
    next(err);
  }
}

export async function permanentlyDeleteProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await adminService.permanentlyDeleteProfile(req.params.profileId as string);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Shortlist Tracking
// ---------------------------------------------------------------------------

export async function getShortlistTracking(req: Request, res: Response, next: NextFunction) {
  try {
    const categoryId = req.query.category_id as string | undefined;
    const result = await adminService.getShortlistTracking(categoryId);
    res.json({ shortlists: result });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// System Automation
// ---------------------------------------------------------------------------

export async function getAutomationSettings(_req: Request, res: Response, next: NextFunction) {
  try {
    const config = await adminService.getAdminSetting('automation_config');
    const templates = await adminService.getAdminSetting('automation_templates');
    res.json({ config: config ?? {}, templates: templates ?? {} });
  } catch (err) {
    next(err);
  }
}

export async function updateAutomationConfig(req: Request, res: Response, next: NextFunction) {
  try {
    const adminId = req.user!.id;
    const current = (await adminService.getAdminSetting<Record<string, boolean>>('automation_config')) ?? {};
    const merged = { ...current, ...req.body };
    await adminService.setAdminSetting('automation_config', merged, adminId);
    res.json({ config: merged });
  } catch (err) {
    next(err);
  }
}

export async function updateAutomationTemplates(req: Request, res: Response, next: NextFunction) {
  try {
    const adminId = req.user!.id;
    const current = (await adminService.getAdminSetting<Record<string, unknown>>('automation_templates')) ?? {};
    const merged = { ...current, ...req.body };
    await adminService.setAdminSetting('automation_templates', merged, adminId);
    res.json({ templates: merged });
  } catch (err) {
    next(err);
  }
}

export async function syncLeadsToCrm(req: Request, res: Response, next: NextFunction) {
  try {
    const adminId = req.user!.id;
    const { syncLeadsToCrm } = await import('../services/automation.service.js');
    const result = await syncLeadsToCrm(adminId);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getCrmStatusMapping(_req: Request, res: Response, next: NextFunction) {
  try {
    const { computeStageLabels } = await import('../services/crm-stage-mapping.js');
    const mapping = await adminService.getAdminSetting('crm_status_mapping');
    // `labels` is a { formType -> { internalKey -> live CRM stage name } } map
    // the Leads boards consume so a CRM rename shows everywhere, not just here.
    const labels = computeStageLabels(mapping as any);
    res.json({ mapping: mapping ?? null, labels });
  } catch (err) {
    next(err);
  }
}

// Lightweight labels-only endpoint for the Leads boards (admin, admin-lite,
// mobile). Resolves under the 'candidates' module so any leads viewer can read
// it, unlike the full crm-status-mapping GET which requires the crm-mapping grant.
export async function getLeadStageLabels(_req: Request, res: Response, next: NextFunction) {
  try {
    const { computeStageLabels } = await import('../services/crm-stage-mapping.js');
    const mapping = await adminService.getAdminSetting('crm_status_mapping');
    res.json({ labels: computeStageLabels(mapping as any) });
  } catch (err) {
    next(err);
  }
}

export async function updateCrmStatusMapping(req: Request, res: Response, next: NextFunction) {
  try {
    const adminId = req.user!.id;
    await adminService.setAdminSetting('crm_status_mapping', req.body, adminId);
    res.json({ mapping: req.body });
  } catch (err) {
    next(err);
  }
}

// Proxies the SquadHire CRM stage-discovery endpoint so the admin UI can
// populate stage selects from real stored names. Auth uses the existing
// shared secret Profiles already sends on outbound (SQUADHIRE_CRM_INBOUND_
// SECRET == shcrm's PROFILES_INBOUND_SECRET). Pipeline name comes from
// ?pipeline=…; the base URL is derived from the configured crm_webhook_url.
export async function getCrmPipelineStages(req: Request, res: Response, next: NextFunction) {
  try {
    const pipelineName = (req.query.pipeline as string | undefined)?.trim();
    if (!pipelineName) {
      return res.status(400).json({ error: 'pipeline query param is required' });
    }

    const mapping = await adminService.getAdminSetting<{ crm_webhook_url?: string }>(
      'crm_status_mapping',
    );
    if (!mapping?.crm_webhook_url) {
      return res.status(503).json({ error: 'crm_webhook_url not configured' });
    }
    const secret = process.env.SQUADHIRE_CRM_INBOUND_SECRET;
    if (!secret) {
      return res.status(503).json({ error: 'SQUADHIRE_CRM_INBOUND_SECRET not configured' });
    }

    let webhook: URL;
    try {
      webhook = new URL(mapping.crm_webhook_url);
    } catch {
      return res.status(500).json({ error: 'crm_webhook_url is not a valid URL' });
    }
    const stagesUrl = `${webhook.origin}/integrations/profiles/pipelines/${encodeURIComponent(
      pipelineName,
    )}/stages`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5_000);
    try {
      const upstream = await fetch(stagesUrl, {
        method: 'GET',
        headers: { 'X-SquadHire-Admin-Signature': secret },
        signal: controller.signal,
      });
      const body = (await upstream.json().catch(() => null)) as
        | { data?: { stages?: Array<{ id: string; name: string; sort_order: number }> } }
        | null;
      if (!upstream.ok) {
        return res.status(upstream.status).json({
          error: 'crm_returned_error',
          status: upstream.status,
        });
      }
      return res.json({ stages: body?.data?.stages ?? [] });
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    next(err);
  }
}

export async function getAutomationEvents(req: Request, res: Response, next: NextFunction) {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Math.min(Number(req.query.limit) || 25, 100);
    const offset = (page - 1) * limit;
    const eventType = req.query.event_type as string | undefined;

    let query = (await import('../config/supabase.js')).supabaseAdmin
      .from('automation_events')
      .select('*, lead:lead_id(name)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (eventType) {
      query = query.eq('event_type', eventType);
    }

    const { data, error, count } = await query;
    if (error) throw error;

    res.json({
      events: data ?? [],
      total: count ?? 0,
      page,
      limit,
      total_pages: Math.ceil((count ?? 0) / limit),
    });
  } catch (err) {
    next(err);
  }
}
