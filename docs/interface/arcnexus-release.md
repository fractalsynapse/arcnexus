# Production release boundary

Stage: **locked**. See the [registry](registry.yaml) for authority and history.

## Obligations

Production release is outside the first CLI build. Staging integration closes the
engineering task and cannot be reported as a production release. Only the maintainer
authorizes and performs the protected-branch merge and tag, and controls publication
and deployment. Published release identities are immutable. A future release
implementation must identify the actual released revision and prove it with live
verification before making a production claim. Release commands and runnable
publication targets remain deferred.

## Acceptance scenarios

| ID | Observation |
| --- | --- |
| RE-20 | Staging evidence cannot satisfy a production release claim, and the runtime refuses a protected-branch merge, tag, publication or deployment. |

## Deferred

The preceding accepted revision records these scenarios. They are outside first-build qualification.

RE-1, RE-2, RE-3, RE-4, RE-5, RE-6, RE-7, RE-8, RE-9, RE-10, RE-11, RE-12, RE-13, RE-14, RE-15, RE-16, RE-17, RE-18, RE-19
