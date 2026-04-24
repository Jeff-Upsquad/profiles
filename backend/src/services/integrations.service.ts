import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.middleware.js';

/**
 * Read-only data exposed to SquadHub via signed integration endpoints.
 *
 * Everything here is public-ish metadata (category names, slugs, descriptions)
 * — no talent PII. SquadHub uses this to populate targeting pickers in its
 * admin UI so that when an admin publishes a subscription card, the
 * `match_rules.category_ids` we receive back are real IDs from this DB.
 */

export interface PublicCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sort_order: number;
}

export async function listActiveCategories(): Promise<PublicCategory[]> {
  const { data, error } = await supabaseAdmin
    .from('categories')
    .select('id, name, slug, description, sort_order')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (error) throw new AppError(500, error.message);
  return (data ?? []) as PublicCategory[];
}
