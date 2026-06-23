'use client';

import { useAuth } from '@/context/AuthContext';
import type { ModulePermission } from '../../../shared/src/types/access';

/**
 * Convenience hook for gating a module's UI. Full admins satisfy every level.
 *
 *   const { canEdit, canFull } = useModulePermission('approvals');
 *   {canEdit && <button>Approve</button>}
 */
export function useModulePermission(moduleSlug: string) {
  const { can, permissionFor, isFullAdmin } = useAuth();
  return {
    isFullAdmin,
    /** The user's tier on this module ('admin' for full admins), or null. */
    level: permissionFor(moduleSlug),
    /** Generic check at an arbitrary level (defaults to 'view'). */
    can: (level: ModulePermission = 'view') => can(moduleSlug, level),
    canView: can(moduleSlug, 'view'),
    canEdit: can(moduleSlug, 'edit'),
    canFull: can(moduleSlug, 'full'),
    canManageAccess: can(moduleSlug, 'admin'),
  };
}
