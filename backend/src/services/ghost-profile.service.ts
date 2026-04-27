import { supabaseAdmin } from '../config/supabase.js';

/**
 * Ghost Designer + Editor profiles.
 *
 * A "ghost" talent_profile is auto-generated when a talent has both a
 * Designer profile and a Video Editor profile. It lives in the same
 * `talent_profiles` table with `is_ghost = TRUE`, and points to the two
 * source profiles via `source_designer_profile_id` / `source_editor_profile_id`.
 *
 * The ghost has `category_id` set to the designer-editor category, so the
 * existing subscription matcher (`subscription-matcher.service.ts`) and
 * business discovery (`business.service.ts`) treat it like any other
 * approved profile — no special-casing needed downstream.
 *
 * Talents never see or manage ghost rows directly; this service is the
 * sole writer.
 */

const DESIGNER_SLUG = 'designer';
const EDITOR_SLUG = 'video-editor';
const GHOST_SLUG = 'designer-editor';

interface CategoryIds {
  designer: string;
  editor: string;
  ghost: string;
}

let cachedCategoryIds: CategoryIds | null = null;

/**
 * Resolve the three relevant category IDs once and cache them. Returns
 * null if any of the three categories is missing — in that case the ghost
 * mechanism is effectively disabled (e.g. a fresh DB without seed data).
 */
async function getCategoryIds(): Promise<CategoryIds | null> {
  if (cachedCategoryIds) return cachedCategoryIds;

  const { data, error } = await supabaseAdmin
    .from('categories')
    .select('id, slug')
    .in('slug', [DESIGNER_SLUG, EDITOR_SLUG, GHOST_SLUG]);

  if (error) {
    console.error('[ghost-profile] failed to load category ids', error);
    return null;
  }

  const bySlug: Record<string, string> = {};
  for (const row of data ?? []) {
    bySlug[(row as { slug: string }).slug] = (row as { id: string }).id;
  }

  if (!bySlug[DESIGNER_SLUG] || !bySlug[EDITOR_SLUG] || !bySlug[GHOST_SLUG]) {
    console.warn('[ghost-profile] one or more required categories missing — ghost sync disabled');
    return null;
  }

  cachedCategoryIds = {
    designer: bySlug[DESIGNER_SLUG],
    editor: bySlug[EDITOR_SLUG],
    ghost: bySlug[GHOST_SLUG],
  };
  return cachedCategoryIds;
}

/**
 * Returns true if the given category_id is one of the two source
 * categories whose mutations should trigger a ghost re-sync. Used by
 * talent.service.ts to skip syncs for irrelevant categories.
 */
export async function isGhostSourceCategory(categoryId: string): Promise<boolean> {
  const ids = await getCategoryIds();
  if (!ids) return false;
  return categoryId === ids.designer || categoryId === ids.editor;
}

/**
 * Returns true if the given category_id IS the ghost (designer-editor)
 * category. Used by talent.service.ts to reject talent-initiated profile
 * creation in this category.
 */
export async function isGhostCategory(categoryId: string): Promise<boolean> {
  const ids = await getCategoryIds();
  if (!ids) return false;
  return categoryId === ids.ghost;
}

/**
 * Reconcile the ghost row for a single talent based on whether they
 * currently have non-deleted Designer and Video Editor profiles.
 *
 * - Both source profiles exist → upsert ghost (status mirrors source
 *   statuses: 'approved' iff both are approved, else 'draft').
 * - Either source missing → hard-delete the ghost row (ghosts have no
 *   value as soft-deleted artifacts).
 *
 * Idempotent and safe to call repeatedly. Errors are logged but not
 * thrown — a failed ghost sync should never block the talent's own
 * profile mutation.
 */
export async function syncGhostForTalent(talentUserId: string): Promise<void> {
  const ids = await getCategoryIds();
  if (!ids) return;

  try {
    const { data: profiles, error } = await supabaseAdmin
      .from('talent_profiles')
      .select('id, category_id, status, is_ghost')
      .eq('talent_user_id', talentUserId)
      .is('deleted_at', null)
      .in('category_id', [ids.designer, ids.editor, ids.ghost]);

    if (error) {
      console.error('[ghost-profile] sync fetch failed', error);
      return;
    }

    const rows = profiles ?? [];
    const designer = rows.find(
      (p: any) => p.category_id === ids.designer && !p.is_ghost
    );
    const editor = rows.find(
      (p: any) => p.category_id === ids.editor && !p.is_ghost
    );
    const existingGhost = rows.find(
      (p: any) => p.category_id === ids.ghost && p.is_ghost
    );

    if (designer && editor) {
      const computedStatus =
        (designer as any).status === 'approved' && (editor as any).status === 'approved'
          ? 'approved'
          : 'draft';

      if (existingGhost) {
        const { error: updateErr } = await supabaseAdmin
          .from('talent_profiles')
          .update({
            source_designer_profile_id: (designer as any).id,
            source_editor_profile_id: (editor as any).id,
            status: computedStatus,
            is_active: true,
          })
          .eq('id', (existingGhost as any).id);
        if (updateErr) console.error('[ghost-profile] update failed', updateErr);
      } else {
        const { error: insertErr } = await supabaseAdmin
          .from('talent_profiles')
          .insert({
            talent_user_id: talentUserId,
            category_id: ids.ghost,
            status: computedStatus,
            is_ghost: true,
            is_active: true,
            source_designer_profile_id: (designer as any).id,
            source_editor_profile_id: (editor as any).id,
            field_data: {},
          });
        if (insertErr) console.error('[ghost-profile] insert failed', insertErr);
      }
    } else if (existingGhost) {
      // Hard-delete: ghosts are auto-generated; soft-deleting just leaves
      // dead rows that confuse the unique index on next re-sync.
      const { error: deleteErr } = await supabaseAdmin
        .from('talent_profiles')
        .delete()
        .eq('id', (existingGhost as any).id)
        .eq('is_ghost', true);
      if (deleteErr) console.error('[ghost-profile] delete failed', deleteErr);
    }
  } catch (err) {
    console.error('[ghost-profile] unexpected sync error', err);
  }
}

/**
 * Test-only / admin helper: reset the cached category IDs. Real callers
 * should never need this — the cache is keyed on slug, which is stable.
 */
export function _resetGhostProfileCache(): void {
  cachedCategoryIds = null;
}
