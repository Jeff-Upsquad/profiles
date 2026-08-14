---
description: Commit, merge into main, push, and deploy the current worktree/branch to production
allowed-tools: Bash, Read, Grep, Glob
---

Ship the current worktree/branch to production. This command is **self-authorizing** — do not ask for confirmation before any of the four steps.

## Steps (sequential)

1. **Commit** — in the current worktree/branch, `git add <specific files>` then `git commit` (HEREDOC message, `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>` trailer). Never `git add -A`.
2. **Merge** — switch to the main checkout at `/Users/jeffzeena/Profiles`. **First verify `HEAD` is actually on `main`** — it is sometimes parked on a feature branch with WIP. Then `git merge --ff-only <branch>`; if a non-ff merge is needed, narrate before doing it.
3. **Push** — `git push origin main`.
4. **Deploy** — `bash /Users/jeffzeena/Profiles/scripts/deploy.sh` (SSHes to the VPS and runs `/root/Profiles/deploy/deploy.sh`: pulls main, rebuilds backend/frontend/admin/admin-lite, restarts PM2, reloads nginx).

## Rules

- **Do not clean up.** Never remove the worktree or delete the branch after cmpd — that's a separate step the user triggers with `cu`.
- **Migrations are not deployed.** `deploy.sh` does not run Supabase migrations. Apply them yourself via the Supabase MCP `apply_migration`, or the CLI/management API. Only hand off SQL when no authenticated path exists — and when you do, paste the runnable SQL inline as a fenced block.
- **Surface manual action items** under their own heading at the end — migrations, restarts, env changes — never buried in prose.
- **Test handoff.** Close with a short plain-language summary: where to go (prod business/talent portals live on `squadhire.upsquadconnect.com`), what changed in user-visible terms (not file paths), and how to test it. If nothing user-facing changed, say so plainly.
- End with the current branch and dirty status.
