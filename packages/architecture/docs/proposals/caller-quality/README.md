# Caller and Testing instruction correction

Status: proposed for exact human review in
[#678](https://github.com/fractalsynapse/arcnexus/issues/678). Active guidance,
locked contracts and the registry remain unchanged.

- [Exact guidance diff](guidance.patch), SHA-256
  `25a53ca4e47f3fea054a2a109fff5446381f56ec84076d10010ed5e763c78e8e`.
- [Baseline and before/after digests](guidance.json), based on staging `c5655fb4`.

The architect requested better Testing instructions, fixture guidance, prevention
of inconsistent supplier links, and continuous Architect assessment of component
purposes and activity instructions. This batch changes their canonical shared
sources rather than copying another checklist into every component.

The Designer role teaches each Testing activity to connect acceptance to concrete
public assertions that reject plausible defective behavior. It covers exact input
preservation, distinguishable restart history, real Cordis injection, observable
streaming before completion, and cancellation during work where applicable.
Fixture guidance preserves complete originals through readable artifact references
instead of recursively copying transcript bodies into new responses. It adds no
content ceiling, truncation, scenario quota or runtime work limit.

The shared Agent protocol explains the binding between an existing milestone and
its accepted owner, with the CLI/Commands mismatch as a concrete example. Host
validation remains necessary and returns that error to the caller regardless of
instruction compliance. Accepted ownership and criteria remain immutable.

Architecture's purpose and Updating procedure explicitly assess instruction quality
against approved objectives, goals, implementation, actual requests and relevant
execution findings on every update. They distinguish inadequate guidance, ignored
adequate guidance, fixture errors, unavailable operations and missing host
enforcement. Assessment proposes precise changes and later checks actual behavior;
it cannot approve its own proposal or infer a profile change.

The prompt-practices reference records this continuing evaluation method. It does
not introduce a loader, new response schema, assessment framework or approval gate.
Existing component-specific procedures, operations, profiles and verification
requirements remain intact. The four changed sources retain the same single-string
request builder and complete-file evidence access.

Walkthroughs: a parser-only assertion cannot prove streaming; current-attempt text
cannot prove resumed history; a read receipt must not become the next transcript
body; a CLI supplier cannot borrow a Commands milestone; a long prompt with the
wrong operation still requires a capability correction. These are authoring checks,
not a claim of real-agent behavioral qualification.

Exact approval and delegation permit applying this patch after its baseline
digests are verified. Implementation, required checks and staging delivery remain
separate. Qualification remains 0/3.
