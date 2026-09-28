# Help & Support → SquadHub bot channel

The public Help & Support chat remains in SquadHire. Ordinary talent messages
and bot replies stay there. When Squad Bot hands a conversation to the team,
the backend posts one idempotent question to its SquadHub `#squad-hiring-bot`
channel with a short transcript and a link to `/admin/squad-bot?chat=<id>`.
The existing Squad Bot Inbox also continues to show the handoff.

This bridge uses `SQUADHUB_BOT_KEY` and the SquadHub API origin already used for
the bot's configuration. `SQUADHIRE_ADMIN_URL` supplies the deep-link origin;
production falls back to `https://squadhire.upsquadconnect.com`. Apply
`20260928150000_squad_bot_channel_bridge.sql` before deploying the backend.

Each handoff has a stable `squadhire:handoff:<conversation>:<timestamp>` event
ID. If SquadHub is unavailable, a background sweeper retries unsent handoffs.
It also polls channel decisions. **Take over** opens the exact SquadHire admin
chat; the bot remains paused. **Tell bot what to do** is claimed once in
SquadHub, passed to SquadHire's existing `instructBot` flow, and its reply is
saved in the original conversation. After a successful reply, the conversation
returns to the bot. Failed instructions retain the human handoff. Outcome
reports are saved locally and retried if SquadHub is temporarily unavailable;
an interrupted send is never automatically executed again.

SquadHire's own Claude prompt reads recent human guidance saved through the
channel. It treats account-specific facts as applicable only to that person.
