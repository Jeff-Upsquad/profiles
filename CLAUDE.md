# Profiles — Agent instructions

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
git branch -D worktree-<name>
```

## Dev server ports

Reserve `+10` per worktree slot so multiple previews can run concurrently.

| App         | main | wt-1 | wt-2 | wt-3 |
|-------------|------|------|------|------|
| admin       | 3000 | 3010 | 3020 | 3030 |
| frontend    | 3001 | 3011 | 3021 | 3031 |
| admin-lite  | 3100 | 3110 | 3120 | 3130 |
| backend     | 5000 | 5010 | 5020 | 5030 |

The four base entries (`admin`, `frontend`, `backend`, `admin-lite`) already exist in `.claude/launch.json`. When you create a worktree you need to preview, **append** a named entry to `.claude/launch.json` pointing at the worktree's subpackage on the reserved port — same style as `/Users/jeffzeena/squadhub/.claude/launch.json`:

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
