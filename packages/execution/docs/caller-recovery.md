# Caller recovery after new answers

Issue [#675](https://github.com/fractalsynapse/arcnexus/issues/675) corrects one
missing input in the existing steward response-repair loop. Run 103 of #668
received a complete research answer, then stopped when the caller repeated a
previous malformed response. The repetition identity included checked file
digests but omitted the newly available answer.

Treat completed research and answered clarification observations as relevant
caller inputs alongside checked file state. Derive that identity from the existing
journal, preserving complete answers and their originating evidence. Replaying an
identical answer, recording another artifact or rephrasing a model claim must not
manufacture progress. An unanswered question is not a completed answer.

Keep the same request loop, diagnostic, activity, ownership, acceptance and checks.
Do not add retry counts, budgets, fallback profiles, stores or orchestration.
Actual unchanged repetition still holds. The correction permits another caller
response when its available knowledge has changed; it does not claim that the
model will finish its assigned work.

Regressions exercise the public steward entry with the real retained journal and
a controlled model boundary. They must first fail when new answers are ignored,
then pass for research and clarification, while duplicate answers and unrelated
artifacts preserve the unchanged-failure hold. Existing checked-edit, response
repair and assembled verification remain required. The retained #668 delivery
and production refinement qualification are separate live evidence.
