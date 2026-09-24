# CU — Cleanup After CMPD

## Objective

Safely remove the worktree(s) and branch(es) **created in the current session**
after CMPD (or after the user cancels that session's work), then reclaim that
session's secondary local and VPS resources.

**Scope rule (user instruction, 2026-09-23):** CU only ever touches work done in
the current session. Never list, offer, or delete other sessions' worktrees or
branches, even when they are merged, because concurrent Claude/Codex sessions
may still be using them. The VPS is shared with other products (SquadHub, CRMs,
upsquad, the demo), so CU never touches anything outside Profiles' own files.

## Preconditions

- The preceding CMPD completed, production health checks passed, and
  `origin/main` contains the feature work.
- Cleanup runs from the primary checkout at `/Users/jeffzeena/Profiles`, not
  from the worktree being removed.

## Steps

1. Fetch origin and inspect `git worktree list`, local branches merged into
   `main`, and matching remote branches.
2. Use a branch named by the user. Otherwise the target is the branch/worktree
   this session created (e.g. its own `git worktree add -b …`, or the worktree
   the session was launched in). If this session created none, report that
   there is nothing from this session to clean and stop — do not pick another
   session's branch.
3. Verify containment in both local `main` and `origin/main`:

   ```bash
   git merge-base --is-ancestor <branch> main
   git merge-base --is-ancestor <branch> origin/main
   ```

   Inspect the target worktree's `git status --short`; stop if it has any
   uncommitted or untracked work.
4. List the exact worktree path, local branch, remote branch, and secondary
   resources (step 6) proposed for deletion. Ask for explicit confirmation
   before deleting any worktree or branch.
5. After confirmation:

   ```bash
   git worktree remove <worktree-path>
   git branch -d <branch>
   git push origin --delete <branch>   # only if it exists on origin
   git worktree prune
   ```

   A missing remote branch is not an error.
6. Clean secondary resources — list exact targets first and require
   confirmation:
   - Local temp junk this session created (e.g. `/tmp/profiles*`, build
     tarballs, the session scratchpad's large outputs).
   - Orphaned local dev servers for the removed worktree (its reserved ports
     from `CLAUDE.md`), and any `.claude/launch.json` entries this session
     added for it.
   - VPS items below only if this session deployed.
   - VPS nginx backups for Profiles — keep the 5 most recent. Sessions snapshot
     the live site config before editing it, as
     `/root/profiles-nginx-*` and `/etc/nginx/sites-available/profiles.bak.*`:

     ```bash
     ssh root@72.61.245.97 'ls -dt /root/profiles-nginx-* /etc/nginx/sites-available/profiles.bak.* 2>/dev/null | tail -n +6 | xargs -r rm -rv'
     ```

     Never delete anything in `/etc/nginx/sites-enabled/`, and never touch
     other products' backups or configs.
7. Report each removed item and whether it was regenerable or recoverable, plus
   the primary checkout's final status.

## Edge cases

- Never use `git worktree remove --force` on a dirty worktree or
  `git branch -D` without explicit instruction.
- Never delete an unmerged branch.
- If there is no branch/worktree target from this session, do not invent one or
  fall back to other sessions' merged branches; this session's temporary-file
  cleanup may still be offered separately.
- If the user explicitly cancels this session's unmerged work (e.g. "cancel
  it"), that is the instruction to discard it: `git worktree remove --force` +
  `git branch -D` are allowed for that session-owned target only.
- Do not delete `.claude/worktrees/` recursively.
- Profiles runs on PM2, not Docker: CU never prunes Docker resources, PM2
  processes/dump, or the `/root/Profiles-demo` checkout.
