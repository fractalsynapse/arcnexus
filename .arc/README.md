# Project knowledge

[Project authority](architecture/project.yaml) and its catalogs are architect-authored
and captured at admission. The capture pins the approved ownership, policies,
checks and trusted plugin composition. [Contract locks](../docs/interface/registry.yaml)
record accepted interface bytes.

The director creates plans from the [template](architecture/plan-template.md). The
host stores structured plan content and renders the reviewable file in `.arc/plans/`.
`.arc/learning/` records observations and proposals. The host persists those records
without giving agents a new file-write scope. The architect can promote a lesson into
a shared standard for future runs. Plans and learning grant no authority.

Run databases, transcripts, logs and bulk artifacts live in external application
storage. Reference them by stable evidence identity.
