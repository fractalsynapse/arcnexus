# Agent test strategy

**Status: architecture, authoritative.** How ArcNexus tests agent behaviour so failures are
attributable to one cause, the same test can be run repeatedly, and cost stays bounded. Read
[the agent harness](agent-harness.md) first: a frame is the unit under test, and captures are the
reason this strategy works at all.

## The two facts this rests on

1. **A frame is a capture.** Inputs, journal, plan revisions and deliverables are all recorded, so a
   frame can be replayed: frozen inputs, real model, comparable output.
2. **Everything outside the model is deterministic.** Admission, checked edits, capture, journaling,
   verdict computation, escalation routing, assembly and the merge protocol are host code. They can be
   tested exhaustively with injected responses and no model call at all.

Therefore: test the deterministic layer to destruction for free, and spend real model runs only where
model behaviour is the thing under test. Debugging the multi-agent system as one long run is the
failure this exists to avoid; long runs are for confirming integration, never for finding causes.

## Layers, and the rule between them

Each layer has an exit criterion, and **a layer may not be relied upon until the layers beneath it
pass their own tests.** Testing a dependent against a flaky dependency produces noise that reads like
agent misbehaviour.

```
L0 static          schema, ownership, guidance, links, digests           no model
L1 frame           one activation, injected responses                    no model
L2 single frame    one activation, real model, k runs                    model
L3 role            transitions between roles, captured inputs            mostly injected
L4 group           assembly, verdict, routing, merge protocol            no model
L5 chaos           interruption at boundaries                            no model
L6 cycle           full loop on a real goal                              model
```

### L0 — static (deterministic, always in CI)

Contract digests and acceptance scenarios; component ownership covering every tracked path; declared
public API imports; guidance metadata and links; prompt and profile inputs present and current.
**Exit:** clean. Cheap, so it runs on every change.

### L1 — frame determinism (no model)

Drive one frame end to end with injected harness responses, asserting the host's obligations: inputs
recorded completely before the model turn; the event journal flushed per event, in order; plan and
checklist revisions captured as they happen; every edit checked against owned paths, including new
files and test paths; mandatory suites undeleted with component, level and tags unchanged before every
declared check; deliverable produced as a
diff against the explicit base; completion gated on the verdict rather than the checklist; escalation
emitted with its required fields.

Assertions target **structure and host behaviour, never model wording**. Exit: every obligation above
has a failing case that is actually caught.

### L2 — single frame, real model (k runs)

The same frames with the real harness. Model output varies, so a scenario is scored on the
**distribution over k runs** — never one green sample. Per role:

| Role | What is measured |
| --- | --- |
| director | owners chosen are eligible; no files named; acceptance criteria present and non-empty; goal restated not narrowed; question when genuinely ambiguous; fan-out proportional to the job |
| steward | plans before editing; edits inside owned paths; revises a failing strategy instead of grinding it; stops and escalates on an authority wall; deliverable matches the request |
| verifier | goal coverage, not only item coverage; deficiencies specific enough to route; no fabrication of evidence |
| stewardship | proposes work it actually owns; reports "no useful work" honestly |

**Exit:** the behaviours we care about are stable across runs, and any variance is classified —
*harness defect*, *prompt weakness*, or *acceptable model variance*. An unclassified flake is a defect.

### L3 — role transitions

Each transition in isolation, from a frozen artifact on one side to a scored result on the other:

- **escalation → director:** a captured notice replayed k times; response scored on whether it changes
  what it should and only that — sequence, another owner, scope, or a human question.
- **peer request → target frame:** captured request to a peer's owned contribution and back.
- **answer → director:** a human answer plus the prior notice replayed; the revised plan must preserve
  goal and acceptance while changing only the path.
- **verdict deficiency → routing:** correct accountable owner, and **no authority widening** for the
  agent that was deficient.

These are cheap because the inputs are already frozen. This is the layer where recursion is proved
without recursion — a notice captured once can be replayed forever, so a director's handling of a hard
escalation becomes an ordinary regression test.

### L4 — group behaviour

Deterministic by construction, so exhaustive: assembly of non-overlapping and **overlapping**
candidates; conflict **detected, evidenced and routed**, never last-writer-wins; verdict reuse only on
identical bytes and inputs, re-verification after any change, and independent verification of the
**assembled tree** distinct from the candidate; merge protocol ordering, refusal on a changed target,
and no release step where none is declared; provider-identity recording once, with views derived from
it.

**Exit:** contention cases pass repeatedly. Deliberately overlapping candidates are required here, not
optional — they are the only honest test of routing, and they are reproducible from stored inputs.

### L5 — chaos

Kill the frame at every boundary: before the model turn, after the first event, after each tool call,
after each edit, after each commit, after a push, after a provider effect whose observation was lost,
and after each assembly step. Assert:

1. the journal holds everything up to the last flush — **real-time capture is proved by interruption,
   not by inspection**;
2. a resumed frame re-observes before it acts, and **never replays an uncertain effect**;
3. recovery from plan, checklist and journal position reaches the same outcome, with no duplicated
   tracking issue, comment, PR or merge;
4. a lost provider observation is repaired, not papered over;
5. every kill path ends in a state a human can diagnose from captures alone.

**Exit:** all boundaries pass. This is the layer that earns confidence in long runs, because it proves
the run is recoverable rather than assuming it will finish.

### L6 — cycles

Only now: a real goal, live lane, no injected anything. Counted as a cycle only on
self-integration; a simulated lane never counts.

## The corpus

A versioned set of goal texts spanning shapes: single-owner docs; behaviour change needing owned
tests; cross-component work; recursive hand-off; ambiguity; missing authority; already-satisfied work;
blocked diagnosis; a large sequential refactor; a demand for evidence the runtime cannot produce;
unrelated work smuggled into one goal.

The corpus belongs to the component that owns direction, and its scenarios are added whenever a live
run surprises us — every real defect becomes a permanent scenario, which is what stops the same class
of failure costing another month.

## Budget, and how cost is measured

- Every PR: L0–L1, plus L3/L4 on changed seams. No model calls, so it is fast and cannot flake.
- Nightly or a labeled run: L2 and L5 with real models.
- L6 by explicit request, since it produces real integration.

Record **measures, impose no caps**: bytes and counts of captured inputs, journal events per activation,
deliverable size, and token usage per activation. A prompt or context change is accepted only when
behaviour holds at lower or comparable cost. The point is visibility, not a limit — cost that nobody
can see is the one that grows.

## What this protects us from, specifically

| Failure mode | Which layer catches it |
| --- | --- |
| A fix that helps stewards but not the director | L2 scored per role, on one harness |
| An agent quietly narrowing its goal | L3 answer replay + L4 verdict on goal coverage |
| Conflicts resolved by whoever wrote last | L4 contention, L5 kill-after-assembly |
| Effects replayed after a crash | L5 kill-at-boundary |
| "It works when I watch it" | L6 only, from a capture; L0–L5 automated |

## Consequences for the harness, stated plainly

1. **Nothing untested may be depended on.** L2 results do not license building L3 assumptions until L1
   proves the host obligations those assumptions rest on.
2. **Assertions never target model wording**, or L2 becomes a noise generator.
3. **A capture must be replayable by the production entry point.** If it cannot, the frame has hidden
   inputs, which is itself the finding — that is the cheapest real bug this strategy surfaces.
4. **Fixtures may not fork the code path.** Replay uses the production entry with recorded inputs; a
   divergent harness manufactures confidence and is worse than none.
