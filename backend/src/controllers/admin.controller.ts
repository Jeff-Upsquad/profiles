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
    const result = await adminService.createTemplateTool(req.params.categoryId as string, req.body.name);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function updateTemplateTool(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await adminService.updateTemplateTool(req.params.toolId as string, req.body.name);
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
// Talents Module
// ---------------------------------------------------------------------------

export async function getTalentCategories(_req: Request, res: Response, next: NextFunction) {
  try {
    const result = await adminService.getTalentCategories();
    res.json({ categories: result });
  } catch (err) {
    next(err);
  }
}

export async function getTalentProfilesByCategory(req: Request, res: Response, next: NextFunction) {
  try {
    const search = req.query.search as string | undefined;
    const result = await adminService.getTalentProfilesByCategory(req.params.categoryId as string, search);
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
      req.body.days
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function suspendUser(req: Request, res: Response, next: NextFunction) {
  try {
    const { suspend } = req.body;
    const result = await adminService.suspendUser(req.params.id as string, suspend ?? true);
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
    const result = await adminService.restoreProfile(req.params.profileId as string);
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
