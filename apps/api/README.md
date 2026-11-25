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
shell and proxies requests under `/api/` to API. The local Compose
frontend supplies the configured operator credential at the proxy.
Direct API calls use the bearer credential. To import a bound fixture,
send its canonical remote as the `remote` field.
The response supplies the project ID. The project endpoint exposes its
OpenAPI document at `/api/projects/{project}/openapi.json`. Connect an MCP
client with the same bearer credential at `/projects/{project}/mcp` on the
MCP port.

The review stack serves pinned Plan guide reads, outcome and metric projections,
and replay and live follow of retained PostgreSQL observations. A project binding’s
`evidence` accepts an absolute mount path or a list of paths for retained and live
Host artifacts. Mount each path read-only at its recorded location. A
registered launcher can use `connect` to keep its authorized presence active.

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

## Browser command controls

The browser follows `GET /projects/{project}/commands/current` with
`Accept: text/event-stream`. Reconnect re-reads the operator's latest receipt
under the selected project. The same route returns a JSON snapshot for a
non-streaming client. The shared dock uses the existing submission, answer
and cancel endpoints. Refine submits one round.

## Managed project bindings

An isolated gateway binding can set `"managed": true` and declare an
absolute checkout path under a trusted writable directory. Mount the same
parent directory into API and MCP. The first import provisions the checkout.
A catalog refresh fetches and validates the new default-branch commit. The
cache keeps previously captured commits for pinned reads.

For GitHub App authentication, register a GitHub App with repository
**Contents** read access and install it on the selected repository. The
gateway binding uses the app's client ID and a mounted private key.

```json
{
  "remote": "https://github.com/fractalsynapse/arcnexus.git",
  "directory": "/managed/arcnexus",
  "managed": true,
  "github": {
    "id": "arcnexus-read",
    "appId": "<GitHub App client ID>",
    "privateKeyFile": "/run/github-secrets/arcnexus-read.pem"
  }
}
```

Mount the PEM read-only with private file permissions in API and MCP.
The gateway discovers the repository's installation and requests a
repository-scoped Contents read token during import and refresh. The
catalog retains only the binding reference. A deployment with an existing
repository-scoped token file can use `github.tokenFile`. See
[GitHub App registration](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/registering-a-github-app)
and [installation authentication](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/authenticating-as-a-github-app-installation).

The isolated API can serve local [launcher artifacts](../launcher/README.md).
See [DB archive and restore](../db/README.md) to rehearse platform recovery.
