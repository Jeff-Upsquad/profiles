-- ============================================================
-- 00076_top_talents_tier_phase2_backfill.sql
--
-- Top Talents tier rename — Phase 2 (data backfill)
--
-- Rewrites every stored legacy lowercase 'elite' to the new canonical
-- 'Top Talents'. Migration 00075 (Phase 1) already widened the CHECK
-- constraints to accept both, so this cannot violate them.
--
-- Applied to production via the Supabase MCP as part of the rename
-- rollout (deploy.sh does not run migrations). Idempotent.
--
-- Covers the talent-side source data AND the mirror of SquadHub cards
-- that Profiles stores in its own subscription_cards table (match_rules
-- target_tiers + content.plan_tier carry the partner tier verbatim,
-- which was PascalCase 'Elite' before the SquadHub backfill).
-- ============================================================

UPDATE talent_profiles  SET tier = 'Top Talents'         WHERE tier = 'elite';
UPDATE lead_submissions SET profile_type = 'Top Talents' WHERE profile_type = 'elite';

-- Mirror of SquadHub cards: content.plan_tier (PascalCase 'Elite').
UPDATE subscription_cards
   SET content = jsonb_set(content, '{plan_tier}', '"Top Talents"'::jsonb)
 WHERE content->>'plan_tier' = 'Elite';

-- Mirror of SquadHub cards: match_rules.target_tiers array (PascalCase 'Elite').
UPDATE subscription_cards
   SET match_rules = jsonb_set(
       match_rules, '{target_tiers}',
       (SELECT jsonb_agg(CASE WHEN e = '"Elite"'::jsonb THEN '"Top Talents"'::jsonb ELSE e END)
          FROM jsonb_array_elements(match_rules->'target_tiers') e))
 WHERE match_rules->'target_tiers' ? 'Elite';

-- De-duplicate target_tiers in case a card already listed both values.
UPDATE subscription_cards
   SET match_rules = jsonb_set(match_rules, '{target_tiers}',
       (SELECT jsonb_agg(v ORDER BY ord)
          FROM (SELECT v, min(ord) AS ord
                  FROM jsonb_array_elements_text(match_rules->'target_tiers') WITH ORDINALITY u(v, ord)
                 GROUP BY v) s))
 WHERE match_rules ? 'target_tiers'
   AND jsonb_typeof(match_rules->'target_tiers') = 'array'
   AND (SELECT count(*) FROM jsonb_array_elements_text(match_rules->'target_tiers'))
       <> (SELECT count(DISTINCT v) FROM jsonb_array_elements_text(match_rules->'target_tiers') v);
