# Direction

Direction turns the goal into the smallest sufficient sequential plan. Its
[contract](contract.md) and the [plan template](../../.arc/architecture/plan-template.md)
govern ownership, acceptance and the five Steps.

## Bounded native revisions

The host retains the canonical accepted plan and committed position. On explicit
escalation or independent rejection, the native Director request supplies immutable
references to that plan and the complete retained observations, the current
position, the finding and its evidence. Completed milestones and Steps are not
serialized into the model prompt or requested in its response.

The model returns the pending sequence. Existing milestones name their ID and
pending Steps; the host retains their owner and criteria without asking the model
to copy them. New milestones supply their complete definition. Direction
reconstructs the sequence against the host's accepted plan and validates ownership, original acceptance, completed work,
supplier scheduling and rejected criteria. Invalid responses return their exact
diagnostic through the existing Workflow repair. Distinct findings stay with the
same Director; an unchanged repeated finding holds with its diagnostic. Initial planning and its repair
still request a complete plan. Clarification and optional research remain normal
activity inbox operations.

The internal Workflow service continues to exchange domain plans by reference.
Only the provider boundary translates to a compact model request and reconstructs
its response. There is no second plan store, SDK protocol or recovery loop.

The [native request scenarios](tests/integration/native-revision.test.ts) inspect
the shared Agent request and exercise Workflow rejection and response repair.
The [reconstruction scenarios](tests/unit/pending-reconstruction.test.ts) cover
partial milestones, original acceptance, supplier scheduling and cursor validity.
