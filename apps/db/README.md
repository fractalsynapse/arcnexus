# Isolated PostgreSQL archives

Use the [gateway review stack](../api/README.md) and a dedicated database.
Stop API, MCP and project Hosts before capturing the database and its
matching Host storage snapshots. Keep the original project, worktree and
artifact mount paths in the Host snapshot. Keep provider credentials and
runtime secret files separate.

The DB CLI uses `backup <archive-directory> <host-snapshot-id>` and
`restore <archive-directory> <host-snapshot-id>`. Run it with
`ARC_ISOLATED_REVIEW=1`, `PGHOST`, `PGPORT`, `PGUSER`, `PGDATABASE`,
and `ARC_DB_PASSWORD_FILE` for the setup account. Use a new archive directory.
The database must be quiescent. Pending approval can be included in the archive.

Use the [DB maintenance image](Dockerfile) with the trusted platform image
from the same build. Mount the parent of the archive directory writable for
backup and read-only for restore. PostgreSQL's own archive tools run inside
this image. See [PostgreSQL dump](https://www.postgresql.org/docs/18/app-pgdump.html)
and [PostgreSQL restore](https://www.postgresql.org/docs/18/app-pgrestore.html).

Restore into a newly created empty database using the same snapshot ID.
Restore validates the archive checksum and the platform migration series.
Use a trusted archive from your own deployment. Run `migrate` with the
deployment's own secret files to grant runtime roles. Restore the matching
Host snapshots at their original mount paths before starting the gateways
or restarting Hosts. The snapshot ID checks the intended pairing. Preserve
the separate Host snapshots together with the database archive.
