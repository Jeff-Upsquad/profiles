# Support Chat in SquadHire CRM

Profiles owns the Help & Support messages and Squad Bot. SquadHire CRM adds
`/app/support-chat` directly below Inbox, with all in-app chats, a Needs team
filter/count, older-message paging, replies, takeover, private instructions and
hand-back. Inbox view/full grants apply. WhatsApp-only conversations and empty
visits are excluded. All CRM actions use the existing signed server-to-server
connection and an operator identity derived from the authenticated CRM session.

## Release order

1. Apply `supabase/migrations/20260928160000_support_chat.sql` to the Profiles
   production database before code deployment. Existing app messages appear
   automatically; no backfill is needed.
2. Confirm the existing SquadHub bot-channel bridge migration
   `20260928150000_squad_bot_channel_bridge.sql` is applied and the Squad Hiring
   Bot has a channel with the intended team members.
3. Profiles uses the existing `SQUADHUB_BOT_KEY` and SquadHub API origin.
   `SQUADHIRE_CRM_WEB_URL` defaults to `https://shcrm.squadhub.in`; set it for
   staging. CRM reuses its Profiles outbound URL and secret and the configured
   Profiles inbound workspace ID. No CRM migration is needed.
4. Deploy the Profiles backend and SquadHire CRM server/web.

## Handoff behavior

A bot uncertainty first pauses its conversation. The existing SquadHub bridge
posts one idempotent question with context and an exact CRM source link and
retries on failure. App handoffs link to Support Chat; WhatsApp handoffs link to
Inbox. Guidance in SquadHub is claimed once, then runs in the original channel.
Takeover keeps the bot paused for a person. The existing Knowledge Center and
SquadHub learning flow remain in use. When a CRM operator replies in Support
Chat, the reply always goes to the talent's Help & Support chat, even if their
newest message was on WhatsApp.

The linked person's bot/handoff status remains shared across app and WhatsApp,
as it was before this module. The migration records each handoff's originating
channel so instructions route reliably. Uncertain executions are held for
manual reconciliation by the existing SquadHub bridge; they are not resent.

## Verification

Profiles backend build, focused routing and bot tests, a disposable PostgreSQL
migration test, CRM TypeScript checks, proxy/authorization tests, and desktop and
mobile browser fixtures pass. After deployment, verify the live path by asking
an uncertain question in Help & Support, checking its CRM chat and SquadHub
question/source link, giving bot guidance, and checking a single app reply.
