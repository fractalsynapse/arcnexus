---
id: cf0325dfeb4552eafd48d97b0f5976b3ecf4dd9fbe7bcc0e7117b97ef1aac830
objective: 4b396d5ebce78f810a14eba618d295f2b2be785af74943398b2abaa79e042015
supersedes: 4b396d5ebce78f810a14eba618d295f2b2be785af74943398b2abaa79e042015
mapping: mapped
revision: 283705d6da44ba3b890a3869c02e33d2e9655200
goals:
  - id: trace-verified-observations
    status: active
---

# Human objective

## Exact submission

```text
Refines 4b396d5ebce78f810a14eba618d295f2b2be785af74943398b2abaa79e042015
Preserve the charter's distinction between source coverage and observed results in the plan-run loop. Set a narrow standing goal for tracing reported verified evidence to its exact observation. When a mapping rates a goal using a verified run, the readable report should identify the selected operation, review criterion, or delivery observation alongside the run and evaluated revision. Currently the report can show only the run ID. Success means focused tests cover the three citation types and the output remains traceable without placing results or component owners in goal files. Keep existing goals and unrelated behavior in scope only for comparison.
```

## Planner interpretation

Propose one narrow standing goal for preserving exact verified-observation citations in readable mappings. Keep existing goals unchanged. Source inspection confirms the reporting gap; no observed test result establishes that it is corrected. The refinement remains consistent with the earlier human answer separating checks, review and integration.

- Source · [docs/charter.md](https://github.com/fractalsynapse/arcnexus/blob/283705d6da44ba3b890a3869c02e33d2e9655200/docs/charter.md)

```text
The host captures and enforces authority, records evidence, and carries
an independently verified candidate through the configured delivery path.
Differences between steward claims, observed checks, review and integration stay
visible. A candidate cannot grant itself permission or weaken its active acceptance.
```

- Source · [docs/dev.md](https://github.com/fractalsynapse/arcnexus/blob/283705d6da44ba3b890a3869c02e33d2e9655200/docs/dev.md)

```text
[Planner](../packages/planner/contract.md) maintains standing goals and human
objective records. Explore the current mapping with `arcnexus task plan` or
submit a human objective to guide it. Review proposed goal edits before delivery.
Bare `arcnexus task run` evaluates the reviewed inventory in priority order.
```

- Source · [packages/planner/contract.md](https://github.com/fractalsynapse/arcnexus/blob/283705d6da44ba3b890a3869c02e33d2e9655200/packages/planner/contract.md)

```text
Goal records contain outcomes and success measures. Planner cites applicable,
host-observed checks, independent review and delivery from Coordination in its
mapping report.
```

- Source · [.arc/objectives/4b396d5ebce78f810a14eba618d295f2b2be785af74943398b2abaa79e042015.md](https://github.com/fractalsynapse/arcnexus/blob/283705d6da44ba3b890a3869c02e33d2e9655200/.arc/objectives/4b396d5ebce78f810a14eba618d295f2b2be785af74943398b2abaa79e042015.md)

```text
Emphasize the charter’s distinction between steward claims, observed checks, independent review, and integration. Keep those observations separate, and preserve the architect’s authority over accepted boundaries.
```

- Source · [packages/planner/src/proposal.ts](https://github.com/fractalsynapse/arcnexus/blob/283705d6da44ba3b890a3869c02e33d2e9655200/packages/planner/src/proposal.ts)

```text
  const citedRun = citesVerifiedRun(value.run, run, capture.source.revision) ? run : undefined;
```

- Source · [packages/planner/src/records.ts](https://github.com/fractalsynapse/arcnexus/blob/283705d6da44ba3b890a3869c02e33d2e9655200/packages/planner/src/records.ts)

```text
    ...(rating.run
      ? [
          `- Verified run · ${rating.run.pull ? `[${rating.run.id}](${rating.run.pull})` : rating.run.id} at \`${rating.run.revision}\``,
        ]
      : []),
```

- Source · [packages/execution/src/goal-evidence.ts](https://github.com/fractalsynapse/arcnexus/blob/283705d6da44ba3b890a3869c02e33d2e9655200/packages/execution/src/goal-evidence.ts)

```text
  if ('operation' in value)
    return run.checks.some(({ operation }) => operation === value.operation);
  if ('criterion' in value) return run.criteria.some((criterion) => criterion === value.criterion);
  return 'delivery' in value && value.delivery === true && Boolean(run.pull);
```

- Source · [packages/planner/tests/unit/proposal.test.ts](https://github.com/fractalsynapse/arcnexus/blob/283705d6da44ba3b890a3869c02e33d2e9655200/packages/planner/tests/unit/proposal.test.ts)

```text
test('source coverage alone cannot give a demonstrated runtime rating', () => {
  const { capture, reply } = new ProposalScenario();
  const ratings = [{ ...reply.ratings[0], evidence: 'demonstrated', observations: [source] }];
  assert.throws(() => decodeProposal({ ...reply, ratings }, capture, [id], false), /verified run/);
});
```
