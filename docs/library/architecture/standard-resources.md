# Platform standard resources

The shared standard resource service reads a committed platform's complete standards
library, including definitions not currently referenced by a component. A standard
belongs to the platform containing its accountable owner. The catalog remains the
authority for ownership, document/example paths and declared check references.

List/get expose identity, purpose, applicability, owner, document, examples, operation
IDs and a revision token. List uses shared id/owner equality filters, purpose/id
search and cursor pagination. Tokens bind the committed source revision; candidate
edits cannot change retained results. Unknown platforms/standards, foreign lookups,
ambiguous definition formats and invalid references fail explicitly.

These are read-only application services, usable independently of terminal or current
directory. The CLI resolves registered platforms and delegates to them. Reads neither
start hosts nor initialize execution storage. This increment does not mutate standards,
compose separate platform/package repositories or grant operation authority.
