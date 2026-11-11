# Record — an activity model I invented rather than received

**Date:** 2026-11-11. **Cycle context:** #389 vocabulary/bucketing batch and live cycles 6–11.
**Written by:** operator agent. **Read as:** history and proposal, not permission.

## Observed failure

The architect's direction was *"the director can not be a special snowflake"* — one **harness** for
every agent. I read that as one **role**, and built on it: a single `systems-engineer` role declaring
all six activities, plus a plan rule requiring every activity the role supports to be declared. That
second rule then *forced* a verifier to declare `implementation` and `testing` buckets and to write a
reason for having nothing to check — and I defended the outcome as "ceremony, honest but cheap" in
#394 instead of noticing the premise beneath it was mine.

The architect's actual model, stated 2026-11-11: **one role per activity** — `researcher`,
`technical-writer`, `designer` (testing), `systems-engineer` (implementation), `tester` (review),
`release-engineer` (release/integration) — with each mode taking the activity sequence its job needs.
Full decision and the list of things that must change: **#394**.

## Cost

- One wrong validation rule shipped to staging in `a39f773`, plus its tests and a CHANGELOG claim.
- Three contracts amended under a reading that was mine (#389: direction, execution, architecture-model).
- #394 raised as an open question that was already decided, costing the architect a decision cycle.
- Live cycles 6–11 all ran under the wrong model, so their plan artifacts carry the all-six declaration
  ceremony; the corpus capture at `~/.local/share/arcnexus/benchmarks/direction-corpus-2026-11-10.json`
  is evidence of the wrong rule, not a baseline to re-qualify against.

## Defect pattern

**Absorbing a constraint into the wrong axis.** "One harness" is about mechanism; I applied it to
identity and capability. Adjacent instances this session: "never duplicate" (evidence bytes) read as
"one store for everything"; "prompts over rails" read as "delete the guidance even where the rule
stays enforced" — which parked live cycle 5 (#407).

## Cheapest check that would have caught it

Before encoding any rule taken from a short directive, restate the rule as a falsifiable sentence and
name what it forbids, then ask which sentence the directive supports. For #389 that question yields:
*"does 'one harness' forbid six roles?"* — obviously no. One line in the plan would have kept the
wrong model from reaching validation.

## Proposed standard (for the architect, not adopted)

A rule copied from a directive into code must cite the sentence it implements at the point of
enforcement (comment or contract clause id), so a reader can test the reading against the source
instead of trusting the implementer. Pairs with #400's lesson: prose rules need an executable check.
