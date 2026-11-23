# Configure component milestone activities

**Direction agreed during UI review.** Architect previews component activity order and how each activity is selected. The exact contract amendment and runtime adoption remain pending.

## Decision

Keep named activity definitions under `activities`. Add an `activityFlow` block with an ordered `sequence` and a `requested` list. Each entry references an activity ID in the same component. An activity can be in only one list. Activities outside both lists remain available through explicit project mappings, such as Director planning and independent assessment. A missing activity remains unavailable.

For a new engineering component, start with Documentation → Testing → Implementation → Review → Release and offer Research on request. Components can arrange their declared activities to fit their work. Sequence order is the dependency model for the initial design. Each activity depends on completion of the applicable earlier activities in the same milestone. Direction records any inapplicable activity and the reason. Requested work runs only on an explicit authorized request and returns its result to the waiting activity. Milestones continue to run in Direction's ordered plan.

The host resolves the flow, role, executor, instructions, operations and required checks from the captured architecture. Preserve the acceptance IDs and recorded evidence. Local review findings name the earliest affected applicable activity in the captured sequence. The host rewinds to that activity and revalidates affected evidence. Final independent rejection goes to Direction with criterion-linked evidence for correction. Release retains its host-only execution and delivery authority.

## Adoption and acceptance

- Prepare the exact amendment to [Direction DI-1](../../../../packages/direction/contract.md) and the [plan template](../../../../.arc/architecture/plan-template.md), which currently specify five milestone steps. Align the affected [Architecture](../../../../packages/architecture/contract.md), [Execution](../../../../packages/execution/contract.md) and [Workflow](../../../../packages/workflow/contract.md) obligations with the approved flow. Author the initial explicit flows from existing component declarations and preserve activity IDs in historical plans.
- Reject unknown activity IDs and repeated memberships. Verify that two components can run different orders through the same task entry point. Verify that requesting research returns to the original activity and leaves its plan position intact. Verify that project-selected activities keep their existing bindings.
- Exercise review rewind with a custom earlier activity. Confirm that the host preserves acceptance and unaffected evidence, and refuses a rewind target outside the captured milestone. Verify that a final independent rejection still routes through Direction and that an agent cannot activate host Release.

## Mockup review

Open a component in Architect. **Milestone sequence** shows the declared order, with **On request** and **Project-selected** activities below it. Enable **Edit** to reorder with the existing drag handles and change an activity's participation. **Raw** and **Changes** show the same draft. For captured files without a flow, the preview seeds the default sequence from activities already declared and groups Research under On request. Creating or renaming activity definitions stays in Raw for this design review.
