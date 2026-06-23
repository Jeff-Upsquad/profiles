import { UserRole } from '../../../shared/src/types/auth.js';
import { ModuleGrants } from '../../../shared/src/types/access.js';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: UserRole;
      };
      talentAccess?: {
        grantId: string;
        email: string;
        categoryIds: string[];
      };
      // Set by requireAdminOrStaff when a staff JWT authenticates. Holds the
      // live (re-checked) per-module grant map. Full admins do NOT set this.
      staff?: {
        id: string;
        email: string;
        name: string;
        grants: ModuleGrants;
      };
    }
  }
}

export {};
