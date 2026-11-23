# Remove operation categories

**Direction agreed during UI review.** The Architect mockup previews the change to the operation YAML. The exact contract amendment, runtime implementation, and adoption are deferred until the UI design is finalized.

## Decision

Remove operation categories from operation declarations and execution profiles. Each activity's `operations` list is its tool allowlist. A bare operation ID uses the resolved defaults. An entry with `operation` and `parameters` grants the same tool and supplies typed values for that activity. Keep component-level parameter defaults for values shared by several activities. Execution profiles select provider settings such as model, reasoning, and web access. [Activity and profile schemas](../../../../packages/architecture/src/catalog.ts#L31) · [Parameter resolution](../../../../packages/architecture/src/operation.ts#L67)

Keep `verification` as a list of operation IDs. Each ID must name a check operation available to the same activity. The agent can run the check while working, and the host requires the same configured check to pass before completion. Resolve its parameters from the activity's operation binding in both paths, without a second place to configure them. Host-required assembled checks and the independent verdict remain delivery requirements. [Binding validation](../../../../packages/architecture/src/validation.ts#L16) · [Activity completion](../../../../packages/execution/src/steward.ts#L235)

## Adoption and acceptance

- Remove `category` and `operationCategories` together from the catalog and authored declarations. Remove the request builder's profile category check. Keep the captured activity as the source of tool authority in both inspection and activation. [Current category check](../../../../packages/architecture/src/request.ts#L167)
- Prepare the exact changes to the locked [Execution contract](../../../../packages/execution/contract.md#L41) and [Verification contract](../../../../packages/verification/contract.md#L6) alongside [Remove operation applicability](remove-operation-applicability.md). Define activity completion checks by explicit operation reference. Retain command confinement, approved arguments, post-run ownership checks, and independent assembled requirements.
- Verify that two activities can use the same profile with different operation lists. Check that unmapped calls and unmapped verification references are refused, and that direct calls and required completion checks for the same binding use identical arguments. Preserve historical observations under their recorded authority.

## Mockup review

Open `owner-tests.yaml` in Architect and enable **Edit**. The Form omits Category and Applicability. **Raw** shows the proposed YAML, and **Changes** highlights both removed lines against the captured revision.
