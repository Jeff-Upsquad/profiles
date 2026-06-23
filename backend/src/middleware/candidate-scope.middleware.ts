import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler.middleware.js';
import { matchCandidateRule } from '../config/candidateRouteMap.js';
import { scopeAllows } from '../../../shared/src/types/access.js';
import { getLeadFormType, getLeadNoteFormType } from '../services/lead.service.js';
import { getInvitationFormType } from '../services/interview.service.js';

/**
 * Second access layer for the Candidates module: gates a staff user's request
 * by their allowed sections (applications/interviews/onboarding) and categories
 * (lead form_type). Runs after enforceModuleAccess (which already checked the
 * candidates module tier). Full admins (no req.staff) and unscoped grants pass.
 *
 * For list endpoints with no explicit category, it stamps
 * req.candidateCategoryFilter so the controller constrains the query.
 */
export async function enforceCandidateScope(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.staff) return next(); // full admin
    const scope = req.staff.candidateScope;
    if (!scope) return next(); // unrestricted within candidates

    const match = matchCandidateRule(req.method, req.path);
    if (!match) return next(); // not a candidates data route

    const { rule, captured } = match;

    // 1) Section gate
    if (scope.sections && scope.sections.length > 0 && !scope.sections.includes(rule.section)) {
      return next(
        new AppError(403, `Access denied: the '${rule.section}' section of Candidates is not in your access`),
      );
    }

    // 2) Category gate (only when categories are restricted)
    const cats = scope.categories;
    if (!cats || cats.length === 0) return next();

    const queryFormType =
      (req.query?.form_type as string | undefined) || (req.body?.form_type as string | undefined);

    switch (rule.category.kind) {
      case 'none':
        return next();

      case 'queryOnly':
        if (queryFormType && !scopeAllows(cats, queryFormType)) {
          return next(new AppError(403, `Access denied: category '${queryFormType}' is not in your access`));
        }
        return next();

      case 'queryList':
        if (queryFormType) {
          if (!scopeAllows(cats, queryFormType)) {
            return next(new AppError(403, `Access denied: category '${queryFormType}' is not in your access`));
          }
          return next();
        }
        // No explicit category → constrain the list to the allowed set.
        req.candidateCategoryFilter = cats;
        return next();

      case 'lead':
      case 'note':
      case 'invitation': {
        if (!captured) return next();
        let formType: string | null = null;
        if (rule.category.kind === 'lead') formType = await getLeadFormType(captured);
        else if (rule.category.kind === 'note') formType = await getLeadNoteFormType(captured);
        else formType = await getInvitationFormType(captured);
        // Missing row → let the controller return its own 404.
        if (formType && !scopeAllows(cats, formType)) {
          return next(new AppError(403, "Access denied: this candidate's category is not in your access"));
        }
        return next();
      }

      default:
        return next();
    }
  } catch (err) {
    next(err);
  }
}
