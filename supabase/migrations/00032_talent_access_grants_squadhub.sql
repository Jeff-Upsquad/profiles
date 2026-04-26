-- Migration: 00032_talent_access_grants_squadhub
-- Description: Cross-link talent_access_grants with SquadHub's
--   profile_access_grants so a SquadHub salesperson can issue a grant
--   from SquadHub and have it land here, identifiable as theirs.
--
--   - squadhub_grant_id           — UNIQUE pointer to SquadHub's local row;
--                                    set when the grant arrived via the
--                                    /api/integrations/squadhub/talent-access
--                                    webhook. NULL for grants originated by
--                                    a Profiles admin in this admin UI.
--   - created_by_squadhub_user_id — the SquadHub user.id of the originator.
--                                    Set additionally to created_by (which is
--                                    the Profiles admin id, now nullable).
--
--   created_by used to be NOT NULL because every grant came from the admin UI
--   here. Loosen it for the SquadHub origination path: when SquadHub creates
--   a grant via webhook, there is no Profiles admin to attribute it to —
--   just the SquadHub user. Existing rows are unaffected (they already have a
--   created_by set).

ALTER TABLE talent_access_grants
    ADD COLUMN squadhub_grant_id UUID UNIQUE,
    ADD COLUMN created_by_squadhub_user_id UUID,
    ALTER COLUMN created_by DROP NOT NULL;

-- Filter to keep the index small — only rows that came from SquadHub.
CREATE INDEX talent_access_grants_squadhub_user_idx
    ON talent_access_grants (created_by_squadhub_user_id)
    WHERE created_by_squadhub_user_id IS NOT NULL;
