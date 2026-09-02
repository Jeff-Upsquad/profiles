# Rollback — Revert and Redeploy

## Objective

Restore Profiles after a bad production release by creating a normal Git revert
commit and deploying it. Profiles does not currently keep versioned PM2 build
artifacts, so rollback is a revert-and-rebuild operation rather than an image
retag.

## Preconditions

- Identify the exact deployed bad commit or range and the last known-good SHA.
- Inspect whether the release included Supabase migrations, data writes, or
  environment changes. Application rollback does not undo any of those.
- Obtain explicit user confirmation for the exact commits to revert.

## Steps

1. Verify production's current SHA and inspect the complete diff from the last
   known-good SHA.
2. Decide whether rollback is safe. Prefer a forward fix when old code is
   incompatible with the current database or when reverting would remove other
   users' valid changes bundled in the same range.
3. In a dedicated worktree, create revert commit(s) with `git revert`; never use
   `git reset --hard` or force-push shared `main`.
4. Validate all affected packages.
5. Fast-forward merge the revert branch into local `main`, push, and deploy via
   [PD](pd.md).
6. Verify the failing user path, both public health endpoints, all five PM2
   processes, and Nginx.
7. Report the reverted range, the new revert commit, what remains unchanged
   (database/environment/data), and the next investigation step.

## Emergency notes

- If production is down while the revert builds, inspect PM2 logs and Nginx
  first; restarting the previous already-built process may be possible only if
  its build directory was not overwritten.
- Do not manually check out an old commit in `/root/Profiles`; the next deploy
  pull can fail or silently diverge.
- Database recovery is separate and requires its own explicit plan.
