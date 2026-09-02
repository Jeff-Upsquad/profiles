# CM — Commit and Merge

## Objective

Validate and commit the current task's changes, then integrate its worktree
branch into the primary checkout's local `main`. Do not push or deploy.

## Steps

1. In the task worktree, inspect `git status`, the unstaged diff, and the staged
   diff. Identify exactly which files belong to the task.
2. Run checks proportional to the changed packages:
   - backend: `npm run build` in `backend/`
   - frontend: `npm run build` in `frontend/` (includes lint)
   - admin: `npm run build` in `admin/`
   - admin-lite: `npm run build` in `admin-lite/`
3. Stage only task-owned paths with `git add -- <paths>`. Never use `git add -A`
   when unrelated changes are present.
4. Review `git diff --cached`, then commit with an imperative message under 72
   characters.
5. In `/Users/jeffzeena/Profiles`, verify the branch is `main` and inspect its
   status. Preserve all unrelated changes.
6. Update local `main` safely with `git pull --ff-only origin main`. If the task
   branch is behind, rebase it onto current `main` from its worktree.
7. Merge with `git merge --ff-only <branch>`. If fast-forward is impossible,
   inspect why and report before creating a merge commit.
8. Stop. Report the commit and local `main` status; do not push or deploy.

## Stop conditions

- A build or required test fails.
- A merge/rebase conflict occurs.
- The primary checkout is not on `main`.
- Unrelated changes overlap the task's files.
- There is nothing task-related to commit.
