# CU — Cleanup After CMPD

## Objective

After a verified CMPD, remove the merged task worktree and its feature branch
without risking unmerged or uncommitted work.

## Preconditions

- Production health checks passed for the last CMPD.
- The target branch tip is contained in both local `main` and `origin/main`.
- The target worktree is clean.
- Run from `/Users/jeffzeena/Profiles`, not from the worktree being removed.

## Steps

1. Resolve the exact worktree path and branch from `git worktree list`. If the
   user did not name one and more than one recently merged worktree is possible,
   ask which one.
2. Fetch origin and verify containment with both:

   ```bash
   git merge-base --is-ancestor <branch> main
   git merge-base --is-ancestor <branch> origin/main
   ```

3. Inspect the worktree's `git status --short`. Stop if it has any uncommitted
   or untracked work.
4. State the exact worktree, local branch, and remote branch that will be
   removed. Obtain explicit confirmation before deletion.
5. Remove the worktree without `--force`:

   ```bash
   git worktree remove <worktree-path>
   ```

6. Delete the local branch safely with `git branch -d <branch>`.
7. If the branch exists on origin, delete that exact remote branch. Do not treat
   a missing remote branch as an error.
8. Run `git worktree prune`, then report what was removed and the primary
   checkout's final status.

## Safety rules

- Never use `git branch -D` or `git worktree remove --force` in CU.
- Never remove more than the resolved task worktree without a new instruction.
- Do not delete `.claude/worktrees/` recursively.
- Profiles uses PM2 rather than per-worktree Docker images, so CU does not prune
  production Docker resources or PM2 data.
