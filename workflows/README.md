# Profiles Workflows

These Markdown SOPs are the instruction layer for repeatable Profiles
development operations. Read the relevant file completely before executing a
named workflow.

## Command shorthands

| Shorthand | Workflow | Result |
|---|---|---|
| **CM** | [cm.md](cm.md) | Commit + merge locally. No push or deploy. |
| **PD** | [pd.md](pd.md) | Push `main` + deploy production. |
| **CMPD** | [cmpd.md](cmpd.md) | Commit + merge + push + deploy. |
| **CU** | [cu.md](cu.md) | Safely remove the merged branch/worktree. |
| **push** | [push.md](push.md) | Commit + merge + push. No deploy. |
| **deploy** | [deploy.md](deploy.md) | Deploy an already-pushed `main`. |
| **rollback** | [rollback.md](rollback.md) | Revert a bad release and redeploy. |

## Operating rules

- Preserve unrelated local changes. Stage only files that belong to the task.
- Feature work happens in `.claude/worktrees/<name>` on a
  `worktree-<name>` branch; the primary checkout stays on `main`.
- Never force-delete an unmerged branch or a dirty worktree.
- Never assume application deployment applies Supabase migrations—it does not.
- Treat production deploys as successful only after health checks pass.
- After any deploy, follow [test-handoff.md](test-handoff.md).

Update these files when a recurring deployment constraint or recovery method is
discovered. Do not replace a workflow wholesale without explicit instruction.
