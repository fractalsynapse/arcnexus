# Planner plugin contract

Stage: **proposed**. See the [registry](../../docs/interface/registry.yaml).

Planner owns standing goals and human objective records. Goals describe durable
outcomes and observable measures. The Director resolves engineering ownership
when a goal is evaluated. Planner reads captured project guidance and implementation
through its Agent activity. Objective clarification uses the task's durable human
question and answer path.

Goal records contain outcomes and success measures. Planner cites applicable,
host-observed checks, independent review and delivery from Coordination in its
mapping report. Repeated exploration can incorporate new observations at the
same revision. An objective can be unresolved. Start an explicit refinement
with a line containing `Refines <full objective record ID>` in the submitted
text. Its new record retains the same objective identity and links to the
superseded record.

The goal approval gate shows an exact line diff. Unknown responses repeat the
gate. A correction after independent rejection proposes revised bytes and
requires approval of its new goal diff.

| ID | Observation |
| --- | --- |
| PLN-1 | Exploration rates every current goal against cited source and captured evidence, compares overlaps and gaps, and reports a proposed change or an explicit no-change result. |
| PLN-2 | Objective mode preserves verbatim submission and human answers with stable links to existing or proposed goals. The objective inventory is derived from records. |
| PLN-3 | The host shows the exact proposed goal changes for human approval. Only approved goal bytes reach the ordinary checked-edit, independent review and staging delivery path. |
| PLN-4 | An interrupted round retains its captured goal inventory. The next fresh round uses the newly reviewed inventory. |

See the [CLI gateway](../../apps/cli/contract.md) and [development direction](../../docs/dev.md).
