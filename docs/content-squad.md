# Content Squad profiles, onboarding and requirements

Implemented on 14 October 2026 across Profiles, SquadHire CRM, SquadHub Web and SquadCRM.

## Role data

The existing basic profile continues to hold personal details, address, languages, employment/Partner Program preferences, availability, salary, resume and onboarding documents. Each new job profile adds a professional title and summary, experience, proficiency-rated categories/skills/tools/AI tools, industry experience and a portfolio. Three portfolio items are required for the five new roles; Designer and Video Editor retain their ten-item minimum. Ads Specialist retains its existing profile schema and gains the missing native editor inputs.

| Role | Profile context | Business requirement details |
|---|---|---|
| Creative Director | Creative leadership, process, team scope and results | Creative scope, objectives, team responsibilities and approval stakeholders |
| Copy / Content Writer | Writing approach, research, brand voice and subject expertise | Formats, topics, volume/lengths and tone/reference content |
| Social Media Manager | Platforms/accounts managed, audience and engagement results | Account handles, current audience, publishing volume and community coverage |
| Videographer / Photographer | Camera/audio/lighting/crew capabilities and travel | Shoot types, location, dates/sessions, shot list, deliverables and intended usage |
| AI Video / Image Creator | Generation/prompting workflow, consistency, finishing and commercial-use checks | Visual formats, quantities/durations/aspect ratios, style references and intended usage |

All five roles have independent application pages, screening questions, editable category catalogs, signup attribution and onboarding filters. Business briefs support both subscriptions and assignments, currency and per-level budgets, locations, languages, skills/tools and voice notes. Specialist briefs can also be created from a SquadCRM deal.

The profile category API now provides the `fields`/`options` names expected by the web builder while retaining `category_fields`/`field_options` for older clients. Drafts can be incomplete; submission validates the complete profile. New public application routes remain usable when a stored login expires.

## Onboarding

Jobs and Partner Program applications retain independent stages and CRM cards. Existing generic Jobs configuration and archived boards are preserved.

Each new role and Ads Specialist has:

- A Partner Program candidate board: application, approval, training, basic profile, job profile, portfolio, final review, Live and exception stages.
- A Jobs candidate board: the Jobs funnel, without a separate portfolio-updation stage.
- A talent board for each program: Welcome, Download App, Onboarding webinar, Webinar registered, Onboarding completed.
- A Partner board: Welcome, Active, Inactive, Suspended and Blacklisted.

Candidate Live hands off to the connected talent board. Completing the Partner Program talent board opens an Active Partner sibling card sharing the person's existing chat; the completed talent card remains as history. Repeated completion events do not duplicate Partner cards. Jobs completion does not create a Partner card.

The admin directories are now explicitly named Onboarded Partners and Onboarded Job Candidates. They contain talents at Onboarding completed on the corresponding track. Other applicants remain in the relevant onboarding hub. Category filters, staff scope options, CRM mappings, application screening and review labels cover the new roles and Ads Specialist.

## Business CRM delivery

Six role-specific lead/deal pairs were created, including Ads Specialist. Qualified leads connect to their deal board; won deals use the existing Content Squad client/onboarding destinations.

Requirement cards enqueue CRM delivery in the same database transaction. A worker retries failed deliveries. A server-only CRM RPC records one receipt per source card and keeps the role's lead plus its submitted requirements. Edits replace that card's requirement details without resetting an operator's stage. The CRM lead/deal Requirements tab displays the submitted brief, specialist details, voice note, timeline and budgets.

CRM and Hub share their Supabase project; the integration uses a service-only RPC with soft source-card references. New tables have RLS, no client policies, explicit service-role grants and revoked anonymous/authenticated access. No existing customer or talent cards were moved during provisioning, and no messages were sent.

## Provisioning status

**Applied and verified in production:**

- SquadHire CRM `20261014130200_content_squad_pipelines.sql`: 12 candidate, 12 talent and 6 Partner boards, 30 total.
- SquadCRM `20261014130400_content_squad_pipelines.sql`: 6 lead and 6 deal boards, plus the private requirement receipt/RPC infrastructure.

**Application code, categories and business catalogs are not deployed yet.** The five new talent categories are not currently live. The remaining database migrations must accompany the coordinated application release:

1. Profiles `20261014130000_content_squad_form_types.sql` (commit enum additions before writes using the new values).
2. Profiles `20261014130100_content_squad_categories.sql` (profile fields, templates, forms and questions).
3. Profiles `20261014130300_content_squad_crm_mapping.sql` (requires the applied SquadHire CRM board migration).
4. SquadHub Web `20261014130200_content_squad_services.sql` (subscription/assignment catalogs and stable talent-category links).
5. SquadHub Web `20261014130500_content_brief_crm_outbox.sql` (requires the applied SquadCRM RPC migration).
6. Deploy the corresponding Profiles backend/frontend/admin/staff, SquadHire CRM server, SquadHub server/admin, and SquadCRM server/web changes through each repository's release workflow.
7. Release the updated talent APK separately so the native editor can enter the required specialist fields.

New subscription pricing/margins use the existing Designer catalog as an initial baseline, following the Ads Specialist pattern; administrators can edit those rates.

## Verification

- Profiles backend, frontend and admin production builds passed; frontend lint had existing warnings and no errors.
- SquadHire CRM server build and targeted routing/graduation tests passed.
- SquadHub server and admin production builds, public web type-check, and role-catalog/commercial-routing tests passed.
- SquadCRM server and web production builds passed with the existing local public auth configuration.
- Flutter analysis of changed profile code and the required-field widget test passed.
- Browser checks rendered all five application/brief pages and checked the mobile layout. The five actual profile create/save/submit UI flows passed with mocked API fixtures, without creating production users.
- Migrations were exercised repeatedly against the actual Supabase schemas inside rollback transactions, including CRM receipt idempotence, edited requirements and the atomic outbox trigger.

A fresh signup and complete onboarding on the deployed applications still needs a release verification run. The source changes are in isolated worktrees under `/Users/jeffzeena/.codex/worktrees/content-squad/`; unrelated primary-checkout changes were preserved.
