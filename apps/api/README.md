# Local gateway review

The root [Compose definition](../../compose.yaml) runs Web, API, MCP,
PostgreSQL and the one-shot DB setup job. The native CLI continues to own
workflow execution during this review. The adapters accept an explicit
operator bearer credential and use distinct PostgreSQL roles. API and MCP have journal read and catalog CRUD grants. API additionally has
enrollment grants. Only DB setup applies migrations.

Use separate directories and credentials for this isolated review. Set
these variables in the Compose environment.

| Variable                     | Value                                                                                                                                                            |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ARC_PLATFORM_REPOSITORIES`  | Host directory with committed fixture Git repositories. Compose mounts it at `/repositories`.                                                                    |
| `ARC_PLATFORM_BINDINGS_FILE` | Trusted local JSON file describing the review operator and repositories.                                                                                         |
| `ARC_PLATFORM_SECRETS`       | Directory with private `postgres`, `api`, `mcp`, and `operator` files. Generate separate values and make the files readable by the local container service user. |
| `ARC_WEB_PORT`               | Local browser port. The review defaults to 38648.                                                                                                                |
| `ARC_MCP_PORT`               | Local operator MCP port. The review defaults to 38649.                                                                                                           |

The bindings file maps a canonical remote to a container path. The
repository origin and captured architecture must match the configured
remote before import succeeds.

```json
{
  "operator": "review-operator",
  "projects": [
    {
      "remote": "https://github.com/arcnexus-fixtures/read-only.git",
      "directory": "/repositories/fixture"
    }
  ]
}
```

Run `docker compose up -d --build` at the repository root. Web serves its own
shell and proxies requests under `/api/` to API. Pass the operator bearer
credential when calling `GET /api/projects` or `POST /api/projects`. To
import a bound fixture, send its canonical remote as the `remote` field.
The response supplies the project ID. The project endpoint exposes its
OpenAPI document at `/api/projects/{project}/openapi.json`. Connect an MCP
client with the same bearer credential at `/projects/{project}/mcp` on the
MCP port.

The review stack serves pinned Plan guide reads, outcome and metric projections,
and replay and live follow of retained PostgreSQL observations. The browser uses
an operator credential held in memory for the review session. A registered
launcher can use `connect` to keep its authorized presence active.

The explicit read-only CLI mode is `arcnexus platform inspect <component> <activity>`.
Set `ARC_API_URL` to the API base, including the Web proxy's `/api` prefix if
applicable, and supply `ARC_PROJECT_ID` and `ARC_OPERATOR_TOKEN_FILE`.

The DB app supports `rehearse-import <project-directory> <journal-storage>`.
With `ARC_ISOLATED_REVIEW=1`, it also accepts
`cutover <project-directory> <journal-storage>`. Cutover fences that fixture's
SQLite store to the verified PostgreSQL deployment. The hosted coordination
primitive can admit one writer and requires a trusted stop confirmation to
release an unfinished lane. The deployed review scope currently exposes read-only
Commands inspection. Workflow submission, container launch and private GitHub
bindings remain pending. Follow the
[architecture proposal](../../docs/plans/mockup/architecture-proposals/data-sdk-and-gateways.md)
for the current implementation and activation gate.
