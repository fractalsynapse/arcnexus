---
id: "file-review"
---

# Provide trustworthy reusable file review and editing

Let operators discover files, inspect their full identity and captured revision, and review complete content and diffs. Provide Markdown rendered and raw editing views that preserve drafts and retain access to syntax unsupported by rich editing. Architecture forms and raw YAML use the owning schema as their validation source.

Keep editing, validation and approval behind the owning service boundary. Local preview edits must remain distinguishable from accepted source changes. Expanding or switching views preserves drafts and useful review state.

Approve the shared file experience in its own acceptance slice before reusing it across workspaces. Converge approved live views and fixture previews on shared presentation, preserving legacy references until their migration is accepted.

## Observable success

- File identity, revision, content and diff remain consistent across views.
- Markdown and YAML draft changes survive view switches and expansion.
- Invalid schema input and unsupported rich syntax remain inspectable without data loss.
- Shared changes affect the corresponding live and fixture views from one maintained source.