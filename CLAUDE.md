# Profiles — Agent instructions

## WAT workflows

This repository uses the Workflows, Agents, Tools (WAT) pattern for repeatable
development operations. Before running a named workflow, read its complete SOP
in `workflows/` and follow it in order. Prefer existing scripts in `scripts/`
and `deploy/` over reimplementing their behavior in ad-hoc shell commands.

The supported command shorthands are:

| Command | Meaning |
|---|---|
| `CM` | Commit the scoped changes and merge the worktree branch into local `main`. |
| `PD` | Push local `main` and deploy it to production. |
| `CMPD` | Commit, merge, push, and deploy—the full release pipeline. |
| `CU` | Clean up the merged worktree and branch after a successful CMPD. |
| `push` | Commit, merge, and push without deploying. |
| `deploy` | Deploy an already-pushed `main`. |
| `rollback` | Revert a bad deployed commit and redeploy the revert. |

Plain requests such as `cmpd`, `/cmpd`, `run cu`, and `push this` invoke the
matching workflow. Deployment workflows must finish with the plain-language
test handoff in `workflows/test-handoff.md`.

## Branching & worktrees

The main repo at `/Users/jeffzeena/Profiles` stays on `main`. All feature work happens in **git worktrees**. The global PreToolUse hook `~/.claude/hooks/block-edits-on-main.sh` denies `Edit`/`Write`/`NotebookEdit` when the target file's repo is on `main` or `master` — so create a worktree (or feature branch) before editing.

### Layout

- Worktree path: `.claude/worktrees/<name>/`
- Branch name: `worktree-<name>`
- `.claude/worktrees/` is gitignored.

### Create a worktree

```sh
git worktree add .claude/worktrees/<name> -b worktree-<name>
```

### Remove a worktree

```sh
git worktree remove .claude/worktrees/<name>
git branch -d worktree-<name>
```

Use the complete `CU` workflow for post-release cleanup. Do not force-remove a
dirty worktree or force-delete an unmerged branch.

## Dev server ports

Reserve `+10` per worktree slot so multiple previews can run concurrently.

| App         | main | wt-1 | wt-2 | wt-3 |
|-------------|------|------|------|------|
| admin       | 3000 | 3010 | 3020 | 3030 |
| frontend    | 3001 | 3011 | 3021 | 3031 |
| staff       | 3005 | 3015 | 3025 | 3035 |
| admin-lite  | 3100 | 3110 | 3120 | 3130 |
| backend     | 5000 | 5010 | 5020 | 5030 |

> **staff** is not a separate package — it's the `admin/` Next.js app started with
> `NEXT_PUBLIC_APP_MODE=staff` (resolves `basePath: /staff`, `distDir: .next-staff`).
> Run it with `cd admin && NEXT_PUBLIC_APP_MODE=staff npx next dev -p <port>`.
> In prod it's a second PM2 process (`profiles-staff`, port 3007) off the same build dir.

The four base entries (`admin`, `frontend`, `backend`, `admin-lite`) already exist in `.claude/launch.json`. When you create a worktree you need to preview, **append** a named entry to `.claude/launch.json` pointing at the worktree's subpackage on the reserved port — same style as `/Users/jeffzeena/squadhub web/.claude/launch.json`:

```jsonc
{
  "name": "<Name> Worktree",
  "runtimeExecutable": "bash",
  "runtimeArgs": [
    "-lc",
    "cd /Users/jeffzeena/Profiles/.claude/worktrees/<name>/frontend && exec npx next dev -p 3011"
  ],
  "port": 3011
}
```

For `admin-lite-mobile` (Expo), start it manually inside the worktree with `npm start`; no launch.json entry needed.

## Linting

`frontend/` has ESLint 9 flat config (`frontend/eslint.config.mjs`, `next/core-web-vitals`).

```sh
cd frontend && npm run lint
```

`prebuild` runs it, so `npm run build` — and therefore `deploy/deploy.sh` — fails on
any lint **error**. Warnings don't block: the pre-existing `exhaustive-deps` /
`no-img-element` findings are parked at `warn` so they stay visible without
gating deploys. Work them down, don't add to them.

`react-hooks/rules-of-hooks` is pinned to `error` on purpose. A conditional hook in
the bottom navs (early `return null` above the remaining hooks) took the whole app
down with "Application error: a client-side exception has occurred" whenever a user
opened a chatroom. Don't relax it.

`admin/`, `admin-lite/` and `backend/` have no ESLint config yet.
