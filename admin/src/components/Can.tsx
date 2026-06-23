'use client';

import type { ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';
import type { ModulePermission } from '../../../shared/src/types/access';

interface CanProps {
  /** Module slug to check (e.g. 'approvals'). */
  module: string;
  /** Minimum tier required to render children. Defaults to 'edit'. */
  level?: ModulePermission;
  children: ReactNode;
  /** Rendered instead when the user lacks the tier. Defaults to nothing. */
  fallback?: ReactNode;
}

/**
 * Renders `children` only when the current user meets `level` on `module`.
 * Full admins always pass. Backend enforcement is the source of truth — this is
 * UX so view-only users don't see write controls they can't use.
 *
 *   <Can module="approvals" level="edit"><ApproveButton /></Can>
 */
export function Can({ module, level = 'edit', children, fallback = null }: CanProps) {
  const { can } = useAuth();
  return <>{can(module, level) ? children : fallback}</>;
}

export default Can;
