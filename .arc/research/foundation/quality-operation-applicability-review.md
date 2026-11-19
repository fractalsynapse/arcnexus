# Corrected quality-operation applicability review batch

Baseline: dfa59ad5c14665d02c1780d6dc060d198784283a
Supersedes: prior unapproved proposal 16f316a75f58cafb2af7057c3c742b1371e3cf9bb26fc44ba8c2b3ce6e077285
Scope: the quality-applicability correction in #623 only.

## Review finding

Keep the captured rule: “Use declared owner-scoped lint, formatting checks and test-profile-selected suites during engineering. Full repository checks belong to assembled deliveries, not every steward activation.”

The prior proposal correctly identified that Testing and Implementation need current per-operation evidence before progression, that intentional expected-red Testing is valid evidence, and that Implementation requires applicable checks to pass. Its repository-wide format/lint mapping during every activation conflicts with captured guidance and must be removed.

The retained #623 analysis remains valid: activity mappings and actual check applicability must prevent a missing owner suite from skipping unrelated checks; expected-red Testing remains distinct from required passing quality checks; Implementation check failures need exact diagnostics routed to the same caller; evidence reuse must match inputs; ordinary local repair, confinement, and independent reviewed staging delivery remain in force.

## Exact guide batch for Architect review

1. Preserve the captured profiles, ownership, original acceptance, existing operations and five mandatory assembled checks. Do not alter contracts, project registries, test profiles, or acceptance. The host derives any registry amendment if an approved contract change later requires one; this batch proposes none.

2. Keep explicit operation mappings in the existing Testing and Implementation activity declarations. Map the existing owner-tests operation and the existing formatting, lint, types and build operations to those activities. These are declarations of applicability; do not add operations to unrelated activities or create a new orchestration framework.

3. Apply operation-specific scope:
   - owner-tests uses the existing test-profile-selected owner suite; no applicable suite makes only owner-tests inapplicable.
   - formatting and lint select only that activity owner's applicable maintained files, resolved through the existing Team ownership boundary and shared Foundation maintained-file discovery.
   - formatting and lint retain their existing executables, configurations, read-only/check flags, and full-repository behavior when invoked without an owner.
   - types and build retain their applicable shared checks and captured commands.
   - Do not duplicate the test inventory, add a second store, hardcode the present owner roster, or add writable automatic fixers. Reuse existing owner argument binding where sufficient.

4. Preserve current per-operation evidence before activity progression. Testing requires applicable formatting, lint, types and build checks to pass; its owner-tests observation retains the declared expected outcome, including intentional expected-red regressions. Implementation requires applicable checks to pass. Missing owner-tests applicability cannot waive another operation or any assembled check.

5. Preserve exact operation identity, scope, diagnostics, exit, log and original expected result when returning a failure to the same caller. Reuse evidence only when its relevant inputs, captured command authority and environment match. Keep ordinary repair in the current milestone, route foreign-owned defects through the existing supplier path, and preserve confinement and single-file checked edits.

6. Retain the existing independent Reviewer and reviewed staging delivery path. Keep the five current assembled checks mandatory and unchanged. Activity evidence neither replaces those checks nor grants delivery authority.

## Prerequisite implementation outcomes before these operation changes activate

- Foundation: extend shared maintained-file discovery to return owner-specific operation selections plus scope and input identity. Resolve owners via Team. Include newly checked-created maintained files; exclude generated and ignored inputs; reject unknown owners and ambiguous ownership. Reuse the existing formatter/linter executables and configurations with read-only flags. Keep formatting and lint selections separate so either can be empty independently. Preserve repository-wide command behavior when no owner is supplied. Add public regressions for distinct owners, newly created files, unknown/ambiguous ownership, separate empty selections, unchanged owner-test inventory, and source immutability.
- Execution: enforce current, input-matched evidence for every applicable mapped operation before progression through the existing confined check path. Preserve expected-red owner-tests in Testing while requiring applicable format/lint/types/build to pass; require passing applicable evidence in Implementation. A missing suite suppresses only owner-tests. Preserve exact failure details through same-caller repair and invalidate evidence affected by edits.
- Architecture: verify inspect and activation expose identical explicit operation bindings for each applicable Testing and Implementation activity, with existing profiles and handlers. Invalid or missing handler references remain unavailable.
- Foundation documentation: state the captured owner-scoped engineering rule and operation-specific applicability above. Do not change other guidance.

Deliver these prerequisite implementations through the existing accountable owners and the normal Architect workflow, together with this exact approved guide batch. They must be implemented and reviewed before the changed operations are activated. Preserve current acceptance and failed observations. The host alone performs assembled verification and delivery; capture the accepted delivery afresh before using changed mappings. Any execution-path change restarts live qualification.

## Observation references (not goal text)

The retained proposal and #623 source analysis are evidence for the assessment, not objectives or acceptance criteria. The latest owner-tests observation for this candidate is exit 1; it reports raw owner arguments reaching Prettier/ESLint as file patterns and failing owner-scoped regression tests. This is implementation failure evidence, not a reason to widen this guide batch or change the original acceptance. Earlier observations 6859 and 6675 record historical code-length defects; they do not assert current files still fail.

No implementation, approval, contract amendment, registry bytes, assembled check result, or delivery is claimed by this review batch.
