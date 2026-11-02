# Continuous integration

CI validates repository guidance and the built TypeScript CLI. Product acceptance
uses temporary real Git repositories and subprocesses; live inference stays separate.

## Contract

Development PRs targeting staging use `development.yaml`. Staging pushes use
`staging.yaml`. Main PRs/pushes and published releases use `production.yaml`.
All call `verification.yaml` and its `Repository checks` job. There are no path
filters that could leave a required check pending. Jobs retain the six-hour
infrastructure ceiling. Only development PR runs cancel superseded runs; staging
and production preserve verification already in progress. See
[delivery verification](verification.md) for the complete lifecycle contract.

The job checks Prettier formatting, syntax-based lint, declared ownership, TypeScript,
built-program acceptance, and tracked guidance metadata, and uses `git diff --check` to reject whitespace errors
introduced by the change. Existing whitespace outside the change is not a migration
requirement. Pull requests compare against their base; pushes compare against the
previous branch head (falling back to the empty tree for a newly created branch).

Skill validation requires YAML mapping frontmatter with a nonempty string `name`
matching its directory and a nonempty string `description`. Names use lowercase
letters, digits, and hyphens. Additional metadata is allowed. Missing frontmatter,
invalid YAML, empty required fields, and an empty skill inventory fail with diagnostics.
Only Git-tracked `.agents/skills/*/SKILL.md` files are inspected; ignored local context
and personal Codex installations are not dependencies. YAML parsing is safe loading.

## Run locally

Use Node 22 and Git. From the repository root:

```sh
npm ci
npm run format:check
npm run lint
npm run check
npm test
node dist/cli.js validate --project .
node dist/cli.js guidance validate --project .
git diff --check origin/staging...HEAD
git diff --check
```

The built guidance command replaces the Python repository checker. Its Node
acceptance tests exercise temporary Git projects, metadata errors, AGENTS inventory
and diagnostics without depending on this repository's guidance wording.

## Extend with the product

The job also installs Node 22, runs `npm ci`, `npm run check`, and `npm test`
(which builds and exercises the CLI), then checks its help output. Keep the shared
`Repository checks` gate; if checks become separate jobs, make it a final aggregator
that fails when any required job fails or is unexpectedly skipped. Add a platform
matrix only when supported platforms need distinct evidence.

Live model acceptance is separate from fast deterministic CI. Never send credentials
or run paid model work from arbitrary PR code. Record real integration evidence when
introducing or changing harness behavior.

The initial workflow uses read-only repository permissions, pinned action commits,
and no persisted checkout credentials. It uses `pull_request`, not privileged
`pull_request_target`. These choices follow GitHub's
[workflow permissions and event syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax).
The pinned actions install Node and check out source. The locked
[yaml parser](https://eemeli.org/yaml/) supplies metadata parsing.

A workflow creates check results; branch protection is a separate repository setting.
Select the actual reusable `Repository checks` check name for each lifecycle if
server-enforced merge gating is desired.
The project release workflow still governs whether agents may merge. Main and
production remain maintainer-controlled.

Repository-aware inspection uses the declared canonical HTTPS origin identity.
After checkout, CI normalizes `origin` to `https://github.com/<owner>/<repo>.git`
before invoking built-CLI catalog checks. GitHub checkout's suffixless remote is
not the repository's declared URL; no fetch or authentication change is required.

## Confined execution prerequisites

Issue #133 adds explicit hosted-runner preparation for the production operation
executor. Install the pinned public Codex runtime under `/usr/local`, where the
read-only system tool boundary can expose its executable bundle. This runtime is
used for local sandbox enforcement; CI does not authenticate or perform inference.

Run the built-program test command as the ordinary runner user in a transient
systemd service with `Delegate=yes`. The service owns a writable cgroup subtree
so the existing executor can supervise and terminate all managed descendants.
Keep source confinement and process qualification mandatory: unavailable delegation
or runtime enforcement fails the job rather than selecting another executor.
Forward the Node tool path explicitly, wait for the service exit status, and collect
its output. The job watchdog remains an infrastructure safeguard, not an agent
execution budget.

These prerequisites follow systemd's
[transient service interface](https://www.freedesktop.org/software/systemd/man/latest/systemd-run.html)
and [delegation contract](https://www.freedesktop.org/software/systemd/man/latest/systemd.resource-control.html).
The initial pinned runtime is
[Codex 0.163.0-alpha.10.2](https://github.com/openai/codex/releases/tag/rust-v0.163.0-alpha.10.2).
Local sandbox probes and the hosted CI result must be reported separately.

The Ubuntu 24.04 hosted runner also installs the distribution `bubblewrap` and its
AppArmor user-namespace profile, following the
[Codex Linux prerequisites](https://learn.chatgpt.com/docs/sandboxing#prerequisites).
The observed pinned-runtime failure was `bwrap: loopback: Failed RTM_NEWADDR:
Operation not permitted`. Load the distribution's specific profile; do not disable
AppArmor's system-wide user-namespace restriction or bypass source confinement.
