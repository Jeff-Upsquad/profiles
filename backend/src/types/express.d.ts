import { UserRole } from '../../../shared/src/types/auth.js';

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
    }
  }
}

export {};
