---
priority: 10
---

# Preserve resumable steward checkpoints

Keep checked edits and the recorded activity position recoverable when a task is
interrupted. Recover the existing issue and issue branch, with only one active
worktree. A failed check must preserve the edits and evidence and leave the
activity pending until its correction passes. Preserve verification and staging
gates and remove task-owned worktrees after their contents are secured.

**Success measures.** The checkpoint scenarios demonstrate that an interrupted
checkpoint is observed before retry, that committed edits survive worktree
removal, and that a completed activity resumes at its successor. An unresolved
failure must retain its exact exit status and evidence.
