# Publication check recovery

Delivery DE-17 returns failed hosted checks as new evidence, preserving the
candidate, issue and existing PR. Collaboration observes the pinned head and
retains complete provider diagnostics; Delivery records them through the existing
artifact store and journal. Publication never edits the candidate.

Workflow returns that evidence to its independent assessment. A valid engineering
rejection follows the existing Direction/steward correction path. Corrected work
refreshes affected checks and obtains a new independent verdict before updating
the same PR. An accepted engineering candidate whose external gate still fails
retains a named hold instead of repeating an identical publication attempt.

Restart observes existing effects first. An unmerged publication needing a new
base or acknowledged candidate returns to normal Execution preparation and
verification. Already merged effects retain their original identity. This adds
no scheduler, store, retry ceiling, size threshold or human approval gate.
