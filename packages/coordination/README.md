# Coordination sessions

The [contract](contract.md) requires one project writer across foreground
refinement, phase assessment and sequential task delivery. The implementation
uses the existing SQLite runs and events. A child session has its own task
identity and retained journal, while its ancestor retains the foreground lane.
Only one child of a session can be active. A session cannot finish before its
child, and closing a child leaves the shared connection and ancestor intact.

Recovery retains the interrupted stack's observations and records its departed
writers before admitting a replacement. Independent invocations cannot borrow a
live writer. Standalone tasks continue through the same admission path.

This is the intended #628 foundation for Architect prerequisites and refinement;
production composition and live evidence remain part of #615 acceptance.
