# Team plugin contract

Stage: **proposed**. The [registry](../../docs/interface/registry.yaml) records its status.

## Team

A Team is a view of the [Agents](../agent/contract.md) that can contribute to a
task. Its steward roster comes from the captured component catalog. A member
identifies its component, the steward that can represent it, its declared
activities and its eligibility at the recorded task position. An eligible
steward need not be active. Team uses Coordination for task observations and
Architecture for catalog and ownership facts.

| Operation | Contract |
| --- | --- |
| `list(scope, query)` | Return the eligible stewards in the captured scope. Filter by component, required activity or recorded task position. Apply the caller's stated ordering or priority and use stable component identity to break ties. Matching inputs produce the same answer. |
| `ownerFor(scope, resource)` | Resolve the resource against the captured ownership map and identify its steward when eligible. Distinguish an unavailable steward, unowned resource and collision. A filtered roster cannot erase a collision or change the resource's owner. |
| `validateCoverage(scope, inventory)` | Report maintained resources with zero or multiple owners and identify the relevant resources and component IDs. Use the same Architecture ownership validation used at admission. It may examine a proposed catalog and inventory before admission. |

The director uses these views to assemble a working team and order the plan.
A steward can identify a supplier and return a request through Agent. Direction
validates and sequences it, reusing accepted work where applicable. Team does
not grant access, run members, maintain a second roster store or schedule work.
A later query may reflect a new recorded position. Catalog changes require a new
capture before they can affect membership or ownership. Validation of a proposed
catalog reports findings without admitting a team or granting authority.

## Acceptance scenarios

| ID | Observation |
| --- | --- |
| TM-1 | A captured catalog yields one available steward entry per eligible component. An activity filter excludes components that lack that activity. |
| TM-2 | Caller priority orders eligible members, stable IDs break ties, and the same inputs produce the same order. |
| TM-3 | A later recorded task position changes the eligible view where applicable without modifying captured ownership. |
| TM-4 | An owned resource resolves to its steward, an unavailable steward is distinguished, and an unowned resource or collision returns a finding even under a filtered roster. |
| TM-5 | A steward requests an identified supplier. Direction reuses accepted work or places the supplier first. The request grants no permissions and no concurrent activation. |
| TM-6 | Coverage findings use the same ownership rules as admission rather than a second authored map. |
