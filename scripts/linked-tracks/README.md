# Linked Jobs + Partner tracks — release steps

Order matters: the CRM must understand `silent` before Profiles sends it.

1. Apply `supabase/migrations/20260926090000_linked_tracks.sql` (Supabase `cwgrooocsklytlmvwabv`).
2. Run `jobs_boards.sql` — creates the three "Jobs – <category>" candidate + talent boards in SquadHire CRM (no automations).
3. Deploy SquadHire CRM branch `worktree-silent-moves` (silent flag; Jobs boards sync back to Profiles). The deploy restart also refreshes its synced-board cache.
4. Run `jobs_mapping.sql` — links the boards as `jobs_creative` / `jobs_accountant` / `jobs_sales` in CRM Mapping.
5. Deploy Profiles.
6. On the VPS: `node dist/backend/src/scripts/backfill-linked-tracks.js --dry-run`, check, then run without `--dry-run`. All moves are silent.
