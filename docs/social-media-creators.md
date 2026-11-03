# Social media creator support

Implemented in the feature worktrees below (Profiles and SquadHire CRM use `codex/social-media-creators`; SquadHub and Squad CRM use `feat/social-media-creators`):

- Profiles: `.claude/worktrees/social-media-creators`
- SquadHub web: `/Users/jeffzeena/squadhub web/.claude/worktrees/social-media-creators`
- Squad CRM: `/Users/jeffzeena/Squad CRM/.claude/worktrees/social-media-creators`
- SquadHire CRM: `/Users/jeffzeena/SquadHire CRM/.claude/worktrees/social-media-creators`

The CRM worktrees synchronize the shared role vocabulary and its hash tests. SquadHub additionally seeds the subscription/assignment catalogs and maps them to the Profiles category. Profiles owns the dedicated `/signup/social-media-creators` page, normal signup option, creator access exemptions, profile fields, Marketing placement and business brief UI. The Flutter talent app respects creator onboarding exemptions, optional basic profile and category ordering.

Creator identity is stored in `talent_users.signup_form_type` or `signup_categories`; mixed-category signup gets the same exemptions. It does not confer admin approval on job profiles. Approved profiles receive the existing category/tier-matched assignment and subscription broadcasts.

Basic profile for creators: at signup every basic-profile section (basic details, language, address, education, experience, job/assignment/subscription preference, resume) is optional — ID proofs and bank account were already optional. The first job profile can be created right away. System-managed ghost profiles and deleted profiles do not count toward this limit. Adding a second job profile requires the complete mandatory basic profile first (`enforceSecondProfileBasicProfileGate` in `backend/src/services/talent.service.ts`, mirrored in the web create-profile page — ID proofs and bank account stay optional for everyone).

Validation for the second-profile gate covers first-profile access, incomplete and complete basic profiles, mixed-category creators, optional ID/bank details, conditional resume requirements, ghost/deleted profiles and query failures. Query failures return a retryable error rather than allowing an unchecked creation. The web selector waits for the completion check and offers a retry on load failure. This change adds no SQL migrations.

## Release dependencies

Follow each repository's release workflow. Before deploying dependent code, apply only these intended migrations using the verified production helpers:

1. Profiles `20261103123903_social_media_creators.sql` on the Profiles database.
2. SquadHub `20261103124153_social_media_creator_services.sql` on the SquadHub database.

Deploy the SquadHub service support before enabling the Profiles business brief UI. Both migrations were executed against isolated PostgreSQL fixtures; production was checked read-only and was not changed.

## Verification

- Profiles backend compilation and frontend TypeScript check pass.
- Frontend lint has zero errors; existing warnings remain.
- 26 focused backend regression tests pass, including signup, creator access, both brief products, category fields and stage timers.
- Browser smoke checks cover desktop/mobile signup, normal signup category selection, the business brief, creator-first profile selection and optional basic profile, using mocked API responses.
- Flutter analysis of the changed screens/model passes.
- All four shared role copies match. Both CRM sync tests and shared compilation pass.
- SquadHub shared/server compilation and its shared-import guard pass. Local validation uses a packed Squad Bots dependency to avoid duplicate Supabase types from the development symlink.
