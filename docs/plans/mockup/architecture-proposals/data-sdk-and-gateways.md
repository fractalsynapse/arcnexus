# Expose Plan through Data and Commands

**Draft for architecture review.** Define two shared Cordis SDKs for the web
app, API, MCP server and CLI. Start with a read-only Plan snapshot and a
timeline that can resume after disconnect. The route, tool and method names
below are proposed.

## Ownership

| Component | Responsibility |
| --- | --- |
| **Data** | Own `packages/data`, its public schemas, and its Plan snapshot and timeline projections. Read from the owning plugins through their public services. Add typed data-management operations as their owning domains and validation rules are agreed. |
| **Commands and Workflow** | Keep command admission, lifecycle and live observations on the existing Commands path. Launch Plan through `planTask` and use the existing Workflow approval and continuation semantics. |
| **Planner and Coordination** | Planner owns objective and goal records and the planning outcome. Coordination owns the retained journal, process position, approval evidence, event order and writer. Approved guide files are read at their captured Git revision. |
| **API, MCP and CLI** | Each app owns its transport, request validation at the edge and output presentation. A trusted host resolves the verified project and applies project and action permissions. Hosted API and MCP processes use the owning plugins for database access. |
| **Web and DB operations** | Web calls the same-origin API and renders its results. The shared PostgreSQL service stays on the server network. A future `apps/db` can compose operator commands for migration, backup and restore when those capabilities exist. |

Architecture would register `data` as the steward for `packages/data`, and
`api-app` and `mcp-app` for `apps/api` and `apps/mcp`. The existing CLI and
web stewards own the integration in their apps.

Publish each Data request and response schema once and derive the HTTP and MCP
schema descriptions from it. For a future file edit, Data would delegate the
typed request to the owning service with the expected revision. Workflow
actions such as approving new goal bytes enter through Commands and retain the
existing exact-diff approval gate. The host resolves project access and
authorizes each snapshot, replay and follow request, including reconnects.
The owning plugins enforce their domain rules. [Project
contract](../../../interface/arcnexus-project.md) · [Planner
contract](../../../../packages/planner/contract.md) · [Commands
contract](../../../../packages/commands/contract.md)

## First slice · Plan snapshot

Propose `data.getPlanSnapshot` as one read over a verified project and, when
supplied, a selected refinement invocation and round. By default select the
active refinement Plan, or the most recently retained refinement Plan in
journal order. Return the resolved Plan identity so follow-up requests stay
pinned while the default selection moves. With no retained Plan, return the
current approved guides at a verified revision and an explicit empty execution
state.

| Snapshot field | Source and behavior |
| --- | --- |
| **Context** | Verified project, refinement invocation, round and Plan identity. Preserve the identities of underlying attempts so an interruption or retry remains visible. |
| **Guides** | Objective and goal summaries from the approved inventory at its captured revision. Return identity, path and revision so clients can link to the right file. Keep proposed changes tied to their recorded baseline. |
| **Execution** | Planner state, elapsed time and recorded usage, outcome and evidence references when available. Derive the state and metrics from retained observations. Carry missing measurements as unavailable and preserve their provenance. |
| **Human decision** | Current question or approval state, exact proposal reference and any recorded reply permitted for this caller. The open gate's identity stays bound to that proposal and Plan. |
| **Observed through** | The cursor for the latest visible Plan observation used by this snapshot. Coordinate the projection and cursor from the same consistent journal read. Guide reads use their pinned revision. |

Start with refinement Plan because its existing invocation, round and child
task identify the selected phase. Standalone planning uses a logical key
derived from the goal and scope. It can reuse that key for another attempt.
Review how to distinguish a new standalone Plan from recovery before exposing
standalone history in this view. Coordination's current open path can create a
store or apply migrations. The Data read needs a read-only Coordination path
that leaves project state and the writer lane untouched. [Refinement Plan
admission](../../../../packages/workflow/src/refinement-run.ts) · [Coordination
source](../../../../packages/coordination/src/index.ts)

## Resumable timeline

- Expose `data.readPlanTimeline` for a finite replay after an exclusive
  cursor. A caller can supply an inclusive end cursor. Otherwise use the
  latest visible event at read start. Return the end cursor with the result.
  Expose `data.followPlanTimeline` to replay and follow after the same cursor.
  Scope every cursor to a verified project and pinned Plan. Preserve stable
  journal sequence values without converting them to JavaScript numbers.
- On first load, fetch the snapshot, read its event history through
  `observedThrough`, then follow after that cursor. A Plan with no observations
  starts follow before the first event. A historical replay ends at its
  selected boundary. Follow queries committed events after the last sent
  cursor at the replay-to-live transition and after reconnect. This catches
  events committed while the snapshot, replay or connection was in flight.
- Deliver in journal order across attempts of the pinned Plan. Consumers
  deduplicate using Plan and event identity and resume from the last event
  they applied. Sequences can have gaps because other observations share the
  project journal. Return a named cursor error if a cursor is invalid or its
  position cannot be recovered. The client can refetch the same Plan and
  replay its available history. Preserve its selection during recovery.
- Retain messages, tool calls and results, lifecycle events and outcomes with
  their original correlations. Use authorized evidence references for
  retained artifacts. Group operations between messages in the web display.
  The canonical replay stays complete within the caller's authorization, and
  a UI disconnect ends its subscription while the host retains the task.
  [Coordination journal contract](../../../../packages/coordination/contract.md)

| Consumer | Proposed binding |
| --- | --- |
| **API and Web** | `GET /projects/{project}/plan` returns the snapshot, with optional invocation and round selection. `GET /projects/{project}/plans/{plan}/events` serves finite JSON replay with `after` and `through`. The same event route serves server-sent events when requested, using `after` for initial catch-up and the SSE event ID and `Last-Event-ID` for transport reconnect. API encodes the scoped Data cursor as the SSE ID. The browser renders the shared data shape. |
| **MCP** | Expose read tools `get_plan` and `read_plan_timeline` with structured results and the same scoped cursor. A client continues a timeline with another read after the cursor it applied. These application tools are distinct from the activity-scoped operations exposed to Codex inside an ArcNexus run. |
| **CLI** | Keep `arcnexus task plan` on Commands with its current output, exit and cancellation semantics. Use Data for future Plan snapshot and timeline reads in the CLI composition. The CLI owns human rendering and JSONL framing for any approved follow mode. |

The adapters use standard [SSE reconnect
semantics](https://html.spec.whatwg.org/multipage/server-sent-events.html#the-last-event-id-header)
and [MCP structured tool
results](https://modelcontextprotocol.io/specification/2025-11-25/server/tools#structured-content).

## Walkthrough

Round 1's Plan snapshot is active through event `413`. It shows the captured
goal inventory and observed Planner metrics. Replay shows the opening message
at `410` and the `list-files` call and result at `411` and `413`. The browser
groups the call and result beneath the opening message.

The browser disconnects after applying `413`. The Planner's approval question
is recorded at `414` during the disconnect. On reconnect, replay after `413`
shows the question once. The browser refreshes the pinned snapshot and displays
the waiting state. An authorized operator then answers at the existing CLI
planning prompt. Replay shows the recorded reply at `416` and the outcome at
`417`. An MCP client reading the same range sees the same records, and the
refreshed snapshot shows the recorded decision and resulting outcome. This
example uses illustrative sequences. A new web or MCP answer command is
outside the first read slice.

## Adoption and acceptance

- Review the ownership and first-slice contract before adding the Data catalog
  entry or gateway apps. Verify that web, MCP and a CLI read adapter return the
  same snapshot fields and event identities for the same caller scope and
  Plan. Test an active Plan, a selected historical Plan, missing measurements
  and a project with approved guides and no retained Plan. Confirm that reads
  create no database, run or journal record.
- Disconnect during a tool result and again across an approval pause or host
  restart. Verify complete ordered replay, deduplication, one recorded answer
  and an unchanged workflow position when a subscriber quits. Refuse a
  cross-project or cross-Plan cursor and preserve correct selection when a new
  round makes the default point elsewhere.
- Keep the initial read slice storage-independent. A future Coordination
  amendment must authorize PostgreSQL and cover a rehearsed import that
  preserves event identities, approvals, unfinished positions and the single
  project writer. Verify that pre-cutover cursors resolve to the same point
  afterward. PostgreSQL's availability in Compose is infrastructure evidence.
- Review exact amendments before adopting any change to locked contracts.
  Live gateway activation and new CLI modes remain subject to the existing
  qualification gate. Launch, steering, command tools and standalone Plan
  history require separately reviewed scope after the read slice. [Locked CLI
  gateway](../../../../apps/cli/contract.md) · [Qualification
  plan](../../self-development-mvp.md)
