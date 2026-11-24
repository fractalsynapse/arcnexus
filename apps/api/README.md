# Local gateway review

The root [Compose definition](../../compose.yaml) runs Web, API, MCP,
PostgreSQL and the one-shot DB setup job. The adapters accept an explicit
operator bearer credential and use distinct PostgreSQL roles with journal
read, catalog CRUD, and workflow receipt permissions. API also has
enrollment grants. DB setup applies migrations. The
[isolated Host](../host/README.md) owns execution and journal writes.

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

The platform CLI uses `ARC_API_URL`, `ARC_PROJECT_ID` and
`ARC_OPERATOR_TOKEN_FILE`. Include the Web proxy's `/api` prefix in the URL
when using that proxy. Use `arcnexus platform inspect <component> <activity>`
for captured Agent inspection. Use `arcnexus platform submit <request.json>`
to submit a JSON object with an operator-generated UUID in `id` and the
structured Commands arguments in `request`. For example, Plan takes
`{"command":"task_plan"}` as the request value. Use
`arcnexus platform receipt <id>` to inspect the result and
`arcnexus platform answer <id> <gate>` to submit an answer via stdin.
`arcnexus platform cancel <id>` requests cancellation.

The DB app supports `rehearse-import <project-directory> <journal-storage>`.
With `ARC_ISOLATED_REVIEW=1`, it also accepts
`cutover <project-directory> <journal-storage>`. Cutover fences that
checkout's SQLite store to the verified PostgreSQL deployment. A trusted
isolated project binding can enable hosted commands and select the admitted
provider UUID. See the [Host setup](../host/README.md) and
[architecture proposal](../../docs/plans/mockup/architecture-proposals/data-sdk-and-gateways.md).
