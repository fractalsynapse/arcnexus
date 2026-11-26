# Isolated hosted workflow setup

Start the [gateway review stack](../api/README.md), then migrate and cut over
a separate fixture checkout and journal. Use explicit provider fixtures for
isolated verification. Real-project activation requires the existing
[live qualification](../../docs/plans/self-development-mvp.md).

1. Load the repository's [AppArmor policy](../launcher/policy/arcnexus-host)
   on the Linux machine that runs Docker. The launcher ships the accompanying
   seccomp filter and selects the named AppArmor policy for each Host.

   ```sh
   sudo install -m 0644 apps/launcher/policy/arcnexus-host /etc/apparmor.d/arcnexus-host
   sudo apparmor_parser -r /etc/apparmor.d/arcnexus-host
   ```

2. Run the DB migration command as the setup role with
   `ARC_HOST_DB_PASSWORD_FILE` pointing to a private password file. Use
   the `arc_host` role and its password in the launcher's local database
   URI file. Set its host to the database address on the internal Docker
   network.
3. Build the [Host image](Dockerfile) from the platform image. Pass the
   approved Codex version as `ARC_CODEX_VERSION`. A derivative Dockerfile
   uses this Host image as its first base and may add project tooling.
   Record the exact base and resulting image IDs. To use a registry image,
   pin its digest and record the approved base and image IDs.
4. Import the bound project using its canonical remote. Mark its trusted
   gateway binding with `"hosted": true` and set `"provider"` to the
   admitted launcher's UUID. A revoked or unassigned provider blocks new
   submissions. To enable raw tool inspection, set
   `"evidence"` to the read-only evidence mount. Use the same absolute
   path inside the gateways as the recorded paths in the Host.
5. Build the local executable with
   `bun build --compile apps/launcher/src/cli.ts --outfile arcnexus-launcher`.
   Configure the API and MCP endpoints, register with an operator-issued
   code on stdin, and admit the provider in the Connection manager.
6. Run `arcnexus-launcher connect <assignments.json>`. The JSON array uses
   the [local assignment schema](../launcher/src/host-assignment.ts). Each
   entry binds the catalog project ID, canonical remote and captured
   revision to local checkout, state, credentials, database URI, network
   and approved image. Keep local paths and credentials under the
   launcher's control. Use `start <assignment.json>` with one object to
   start the Host explicitly.

Use `arcnexus-launcher doctor` to verify the configured API and MCP
endpoints. When `source` names an existing verified local checkout, the launcher
copies its committed Git objects into an absent `checkout` and checks out the
pinned revision. The Host installs its Codex binding if the checkout has none.
Launch returns after the container passes its sandbox and database startup
checks.

For a fixture that uses real external providers, create a dedicated Docker
bridge ending in `_outbound` and set the trusted assignment's `egress` to its
name. The Host also joins its internal data network. Scope any outbound firewall
rules to the trusted provider endpoints. Project checks use a separate network
namespace regardless of the Host's egress network.

Set the optional `github` assignment to
`{"appId":"<client-id>","privateKeyFile":"/private/host-app.pem"}` to
authenticate GitHub operations. Use a private file outside the project and
install the App on the approved targets. The Host obtains repository-scoped
tokens and supplies them to Git and GitHub CLI. Keep gateway read tokens and
the Host's publication key on their respective trusted mounts.

The Host holds its journal lane until committed completion or trusted
reconciliation. Restarting the same scoped container lets its new init
process reconcile the former process and resume retained work. A changed
image or assignment requires removing the old stopped container under
operator control. A subprocess and its optional project check scripts use
the Host's existing confinement rules. The [runtime policy](../launcher/policy/README.md)
requires AppArmor ABI 5.0 and a Docker Engine with seccomp enabled. The Host
probes the actual overlay and namespace isolation before claiming requests.
Replace earlier Host containers with the rebuilt image and launcher to adopt
the new policy.

Use the [gateway's GitHub App binding](../api/README.md#managed-project-bindings)
for private managed reads. Supply a separate approved Host checkout when
assigning execution.

## Read-only Plan onboarding

For a repository that only has documentation, set `"documentationOnly": true`
on its trusted gateway binding and assign an admitted provider. Import it by its
canonical GitHub remote. The gateway can verify a local pinned Git tree or fetch
one through a managed read binding.

Set `"documentationOnly": true` on the matching launcher assignment. Use the
approved platform Host base image with `"source": "base"` and its digest for
both `base` and `approvedImage`. Omit the Host's GitHub write credentials. The
launcher mounts the checkout read-only. Plan reads pinned Git objects from a
neutral Codex workspace through the existing read and list tools. Repository
guidance, tools and executable bindings do not take effect.

The operator can retain selected drafts, edit and re-review them, request a
revision, or decline. The request and its review are stored with the project's
Plan history. To admit the project, set up its catalog, normal verified staging
workflow and Host binding. Cut over the journal, replace the discovery binding
with an ordinary hosted binding for the same remote, and refresh the catalog
revision. The next recommendation session reviews retained drafts at the
admitted revision and identifies changed citations before asking for approval.
