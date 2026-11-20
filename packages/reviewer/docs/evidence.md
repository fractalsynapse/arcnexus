# Complete evidence through the existing file index

Final assessment and citation repair use Execution's retained-evidence index.
The request names that complete file and the current candidate diff; the mapped
read-file tool discovers original artifacts through their retained paths.
All original evidence remains available, and citations are validated against the
host's complete retained evidence set.

This follows Verification VI-4 and the Reviewer contract. Do not serialize the
whole historical path catalog into the initial request or a citation repair.
Reuse the existing index format and immutable artifact storage. Evidence, reports
and file reads remain complete: there is no size threshold, truncation, sampling,
pagination, new store or alternate assessment lifecycle.

The regression must exercise the public Verification/Reviewer call and successive
invalid citations. Every assessment request must retain the complete catalog by
reference while preserving candidate, acceptance, exact diagnostics and check
reuse. A live continuation must then independently review the retained #668
candidate and deliver it through the ordinary staging path.
