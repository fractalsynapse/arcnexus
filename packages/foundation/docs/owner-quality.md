# One owner-scoped quality path

The retained quality candidate introduced a second configuration-dependency
analyzer and hundreds of lines of selection identity machinery. Replace those
responsibilities with the existing Git input identity and conservative check reuse:
when the committed candidate changes, observe the check again. Keep the original
checkpoint and failed evidence outside source; simplification does not turn those
attempts into successful delivery.

`npm run format:check -- <owner>` and `npm run lint -- <owner>` select maintained
files through Git and Team, then use the existing Prettier or ESLint configuration.
With no owner they retain repository coverage. Both are read-only. Unknown owners,
ambiguous ownership and invalid configuration fail. New maintained untracked files
participate; ignored/generated files do not.

Discovery and tool configuration execute inside the existing confined check
process, rather than evaluating candidate configuration in the trusted host. The
runner records its complete selected scope in the check log. Execution validates
the observed selection against captured Team ownership and reports an empty
selection as inapplicable only for a declared owner-quality operation. An owner's
missing test suite does not suppress formatting, lint, types or build checks.

Activity requirements refer to operation bindings through the existing
`verification` field. Testing retains an intended red observation separately from
checks that must pass at that point; Implementation requires passing applicable
checks. These declarations remain proposals until their exact architecture batch
has approval. The assembled checks and independent review remain mandatory.

No additional store, recovery framework, configuration dependency graph, warning
ceiling or fine-grained reuse classifier is needed. This bootstrap addresses the
named missing capability: safe, real owner-scoped quality checks usable by the
retained Architect delivery. Its native confinement and live delivery evidence
must be reported separately from unit tests.
