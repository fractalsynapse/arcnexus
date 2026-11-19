# Accepted quantitative limits

This is the approval log required by [AGENTS.md](../../AGENTS.md). A quantitative
limit may be implemented only when an entry here records the human architect's
express approval. Agents cannot authorize limits. Each entry must identify the
scope, exact approved value or rule, and the actual approval evidence. Changing a
value or extending its scope requires express human approval recorded here first.
Code, an agent's recommendation, and an existing unapproved limit are not approval.

Recorded on 2026-11-19 from explicit human instructions in this conversation:

| ID | Scope | Approved limit | Human approval evidence |
| --- | --- | --- | --- |
| CODE-FILE | Maintained code after formatting | 500 physical lines per file, including comments and blank lines | Human-provided AGENTS.md instructions: “maintained code files must fit within 500 physical lines”. See [TypeScript standard](../../docs/foundation/typescript-standard.md). |
| CODE-FUNCTION | Functions, methods, constructors and callbacks after formatting | 30 physical lines, including comments and blank lines | Same explicit instruction: “functions, methods, constructors, and callbacks within 30, including comments and blank lines.” |
| PROJECT-WRITER | Agent execution within a project | One active agent activation and one sequential project writer | Human restart direction: “sequential, non-containerized, single-worktree and branch”; approved implementation plan: “one project writer across the foreground refinement invocation”. See [Execution](../../packages/execution/contract.md) and [Coordination](../../packages/coordination/contract.md). |
| CHECKED-FILE | An acknowledged model checked edit | Exactly one maintained file per edit | Human instruction: “require the steward to write one file at a time”. See [Execution](../../packages/execution/contract.md). |
| MILESTONE-OWNER | An accepted milestone | Exactly one accountable component owner | Human-provided AGENTS.md instructions: “Each milestone has exactly one accountable owner”. See [plan template](plan-template.md). |
| REFINEMENT-ROUNDS | Requested refinement invocation | Positive integer round count supplied by the caller; default one round | Human-approved implementation plan: “Default to one round; require a positive integer.” This authorizes the requested count, not a separate automatic maximum. |
| QUALIFICATION | Completion of the self-healing refinement plan | Three consecutive successful live refinement rounds | Human implementation request: “The plan is complete only when that live evidence demonstrates three successful continuous rounds.” This is acceptance, not a runtime retry or work budget. |

No research request length, report length, source count, unresolved-question count,
research-history count, Planner document size, or context truncation cap has an
approval entry. Such limits are not authorized.
