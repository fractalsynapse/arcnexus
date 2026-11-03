# Publisher

Publisher receives host-captured run, assignment and candidate evidence. It retains
an immutable delivery only after validating that the candidate still matches the
independently reviewed result. Delivery approval is local authorization for that
revision; it is not a GitHub review or permission to bypass CI.

Coordination-store owns durable delivery transitions and external-effect receipts.
Operations owns supervised effects and provider transport. Publisher owns the policy
that connects verified engineering to those effects. Worker input cannot replace
captured owner, repository, environment, candidate or verification authority.

Live and simulated deliveries use the same state model. Promotion preserves the
simulation record and creates a different live delivery after current-target
reconciliation and fresh verification. Real main merges, tags and package publication
remain outside this increment's automatic authority.
