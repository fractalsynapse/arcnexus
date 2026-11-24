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
