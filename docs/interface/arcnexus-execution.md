# Library contract — Execution

Type contract: `library`. Stage: **locked** (revision 2). Owner: `execution` (absorbs
`execution-runtime`, `workspace`, `steward`, `operations` and `change-inspection`).
Depends on: [`arcnexus-project.md`](arcnexus-project.md), [`arcnexus-architecture-model.md`](arcnexus-architecture-model.md), [`arcnexus-coordination.md`](arcnexus-coordination.md).
Depended on by: `direction`, `verification`, `delivery`, the gateway, and every agent turn.

Execution is the only part of ArcNexus that touches a repository working tree, a sandbox or a
model. It performs work and reports what happened. It owns no lifecycle state, no plan order and
no authority — those belong to coordination, direction and the architecture model respectively —
and that boundary is the whole reason this contract exists.

## Identity

| Field | Value |
| --- | --- |
| component | `execution` |
| paths | `src/library/execution`, `tests/library/execution`, `docs/library/execution` |
| current cost | 14,941 lines: `execution-runtime` 5,054 · `operations` 5,749 · `workspace` 2,212 · `steward` 1,766 · `change-inspection` 160 |
| target cost | ~3,500–4,500 lines |
| process topology | the calling process is the host: one lane, one activation at a time, no daemon, no socket, no lease database |

## Provides

| Service | Obligation |
| --- | --- |
| `lane(project)` | the single sequential executor for one project. It runs one activation at a time and reports the busy lane to coordination; it does not schedule, prioritise, rotate or queue |
| `workspace(goalId, milestoneId)` | an isolated worktree at the milestone's captured base, with declared generated directories, setup operations resolved from the captured check catalog, and identity assertions that refuse a workspace belonging to another revision |
| `checkedEdit(request)` | the only write route to maintained source: ownership scope from the capture × current step × symlink and alias rejection × expected-content-hash conflict. Returns the applied change or a typed refusal naming the owner and the reason |
| `activate(component, activity, milestone)` | build context **through `architecture-model.contextFor`, the same generator `inspect` renders**, run the harness, stream events to coordination, and return a typed outcome with evidence references |
| `runOperation(id, args)` | resolve one declared operation from the capture — prerequisites, generated directories, network policy, artifacts — execute it under supervision, and return exit status, duration and log paths |
| `confinement(policy)` | one mechanism: read-only source, declared writable outputs, declared network, capability probes. Identical for live and simulated work; only the upstream namespace differs |
| `snapshot(workspace)` | candidate change inspection: staged, unstaged and untracked detected separately, with a content digest. Restoring a working file cannot hide a staged edit |
| `assemble(contributions)` | merge the prepared contributions of one milestone into one candidate. A conflict stops assembly and retains both sides; nothing is silently overwritten |
| `cancel(reason)` | prompt, total cancellation: stop the process group, close the harness, retain workspace, branch and evidence, and record exactly one terminal outcome |
| `progress(activation)` | observable progress: activity events used to detect a stalled activation. There is no time, turn, call or attempt budget anywhere in this contract |

## Must never do

Decide authority, order milestones, hold lifecycle state, publish or merge anything, talk to an
upstream that the delivery policy has not declared, maintain a second context generator, or keep a
recovery path for a state coordination no longer defines.

## Enforcement this contract carries

ARC-12 lands here. `checkedEdit` refuses any write targeting a file registered as a `locked`
contract unless the run's captured authority contains a recorded human acceptance naming that
contract id. The refusal is typed, names the contract and the clause, and produces an inbox-free
counter: the run continues with work that does not depend on it, and the gate is reported. This is
the difference between a documented rule and a rule a run cannot cross.

## Invariants

| # | Invariant |
| --- | --- |
| I1 | One context generator. `activate` and `inspect` cannot diverge, because they are the same call. |
| I2 | `checkedEdit` is the only path to maintained source. No shell write, no direct filesystem write, no patch bypass. |
| I3 | Authority comes from the capture, never from arguments the agent supplies. |
| I4 | A locked contract cannot be written by a run without recorded human authority. |
| I5 | One confinement mechanism. Live and simulation differ only in namespace and upstream refusal. |
| I6 | One lane per project, one activation at a time. No nested scheduler, no intra-project concurrency. |
| I7 | Cancellation is prompt and total, and yields exactly one recorded outcome. |
| I8 | No budgets. Governing is by observed progress and cancellation. |
| I9 | Every execution produces evidence: command, working directory, exit status, duration, log path. A skipped check is never reported as passed. |
| I10 | A workspace is disposable and revision-bound. It is never reused across bases, and disposal never deletes authored evidence. |
| I11 | Assembly is a merge. Conflicts are retained and reported; they are not resolved by preference. |
| I12 | Execution holds no lifecycle state. Status lives in coordination; execution returns outcomes. |
| I13 | Model selection comes from the activity's profile. An operator substitution is permitted, recorded in evidence, and never changes captured authority. |
| I14 | Nothing in the lane, workspace or confinement interface precludes a background host running several goals concurrently. The MVP runs one in-process lane, and the container deployment seam is retained so the later service is a deployment change rather than a redesign. |

## Acceptance scenarios

| Id | Given / when / then |
| --- | --- |
| EX-1 | A checked edit inside the owner's scope at the current step applies and records the change with its before and after digests. |
| EX-2 | The same edit against a stale expected hash is refused naming the file, and nothing is applied. |
| EX-3 | An edit to a path owned by another component is refused naming that owner, and no duplicate milestone or agreement request is created. |
| EX-4 | An edit targeting a locked contract file is refused for a run without recorded authority, and applied for one that carries it. |
| EX-5 | A symlink, alias or hardlink anywhere in the workspace, target path or evidence path is refused. |
| EX-6 | `activate` produces byte-identical context to `inspect` for the same revision, component, activity and milestone, apart from declared placeholders. |
| EX-7 | Two activations in one project cannot overlap; the second is refused while the first holds the lane. |
| EX-8 | Cancellation during a running operation stops the process group, leaves no orphan, and produces one terminal event and one terminal state. |
| EX-9 | An activation with no observable progress is reported as stalled with its last evidence; no budget ever terminates healthy work. |
| EX-10 | Every executed operation yields command, cwd, exit, duration and log path in evidence; a skipped check reports as skipped. |
| EX-11 | A workspace prepared at one base cannot be used for a milestone captured at another; the mismatch is refused before any edit. |
| EX-12 | `snapshot` distinguishes staged, unstaged and untracked changes, and reverting a working file does not hide a staged edit. |
| EX-13 | `assemble` of two non-conflicting contributions produces one candidate with both attributions intact. |
| EX-14 | `assemble` of conflicting contributions stops, retains both sides with their evidence, and reports the conflict rather than choosing one. |
| EX-15 | A simulated activation cannot reach a live upstream, cannot write a live record, and uses the same confinement and lifecycle code as a live run. |
| EX-16 | An operation outside the activity's declared categories, or with an unmet prerequisite, is refused before execution with the reason named. |
| EX-17 | Deleting the recovery, retained-host, promotion-resume and lease modules leaves no caller in the execution path. |
| EX-18 | An operator model substitution changes the model used, is recorded in evidence, and leaves captured authority and findings identical. |
| EX-19 | Two lanes for two different projects can exist in one process without interference: the lane is obtained per project, holds no process-global mutable state, and neither activation observes the other's workspace, store or evidence. |

## Migration

| Current | Target | Effect |
| --- | --- | --- |
| detached host daemon, unix socket, `host.lease`, `host.json`, readiness probing, `retained-host` | the calling process is the host | removes ~700 lines of supervisor ceremony and the cold-host failure class that produced issue #285 |
| `scheduler`, `run-selection`, `workday-selection`, `collaborative-dispatch`, `request-admission`, `assignment-recovery`, `policy-recovery`, `host-recovery` | `lane` | one executor, no alternate orchestration paths |
| `run-promotion`, `promotion-control`, `promotion-recovery`, `promotion-review`, `promotion-assembly`, `simulation-repositories`, `run-publication` | move to `delivery`; promotion is deleted | removes the simulation→live promotion subsystem (~674 lines) |
| `operations` live and simulated twins: `github-*` and `simulated-*`, `provider-store`, `upstream-bridge`, `network-qualification` | one transport plus a namespace refusal | removes 44 live-versus-simulation branch points and one publication engine |
| `workspace`: `retention-catalog`, `evidence-retention`, `dependency-cleanup`, `cleanup` | disposal plus coordination's retention policy | removes ~700 lines of evidence garbage machinery that the cap and cache rule replaces |
| `steward`: `thread-recovery`, `pending-calls`, `bridge-preflight`, `client-home` ceremony | harness execution with cancellation and evidence | keeps the bridge and tools; drops the rescue paths |
| `change-inspection` | `snapshot` | absorbed, unchanged semantics, one fewer component |
| container, AppArmor profile, generated seccomp, dedicated cgroup subtree as prerequisites | optional deployment profile | a cycle can complete on one machine without them; confinement itself is unchanged |

Migration lands across cleanup batches 2, 3 and 4 (one process, one gate, one route) and is
verified by EX-17 together with CO-16: nothing left to rescue, nobody left calling the rescue.

## Non-goals

Concurrency inside a project, distributed workers, priority scheduling, checkpoint-and-resume of a
dead run, self-healing of a broken workspace, budgets of any kind, agent-to-agent conversation, and
any execution path that exists only to preserve a historical run.

## Accepted decisions

1. **Confinement default:** bubblewrap-in-process is the only required mechanism for a cycle; the
   container with AppArmor, a generated seccomp profile and a dedicated cgroup subtree is an opt-in
   deployment profile. **The container seam is retained** — the lane, workspace and confinement
   interfaces must not assume a single foreground process, because this becomes a background
   service running several goals at once (I14, EX-19).
2. **Lane ownership:** `execution` holds the lane; `direction` holds plan ordering. The lane
   executes; it does not decide what comes next.
3. **Harness state:** per activation, inside `execution`. No shared machine-level home, so one
   activation cannot inherit another's thread history or configuration, and disposal is local.

## Lock record

```yaml
id: arcnexus/execution
stage: locked
revision: 2
acceptedBy: Adrian Webb (architect)
acceptedAt: 2026-11-07
changes:
  - revision 2: locked with the architect's answers — bubblewrap required and the container kept as
    an opt-in deployment seam with concurrency preclusion forbidden, the lane in execution with
    ordering in direction, and harness state per activation. Added invariant I14 and scenario EX-19
  - revision 1: proposed in #352 with three open questions, all since answered
```
