# Release contract — ArcNexus

Type contract: `release`. Stage: **proposed**. Owner: `release`.
Depends on: [`arcnexus-project.md`](arcnexus-project.md), [`arcnexus-delivery.md`](arcnexus-delivery.md), [`arcnexus-verification.md`](arcnexus-verification.md).
Depended on by: the project's delivery policy, the gateway's reserved `release verify` command, and
every claim that a version exists.

Release turns an accepted candidate on the protected branch into a versioned, identifiable artifact
and proves it works where it runs. **Today that means the CLI only.** Container images, a connected
runner, a package-registry entry and system installers are the declared direction; they are recorded
here as reserved targets so they shape the interface without costing a line of code now.

## Identity

| Field | Value |
| --- | --- |
| component | `release` |
| paths | `.github`, `docker`, `scripts/release`, `docs/release` |
| current surface | four workflow files, the multi-stage image with its entrypoint, AppArmor profile and generated seccomp policy, two release scripts, three documents |
| active targets | the CLI package: a tagged commit on the protected branch with a version and changelog; and an **npm package** published from that tag |
| reserved targets | container image on GitHub Container Registry; connected runner (local executable); Debian and RPM installers that provision the harness and the ArcNexus processing service |
| eventual shape | the processing service connects to ArcNexus remote API and MCP gateways and animates them against a project over time |

## Provides

| Service | Obligation |
| --- | --- |
| `candidate(previousRelease, head)` | the release candidate: shipping changes derived from the pinned previous-release-to-candidate range, version and changelog edits, and the protected-branch pull request. Prepared by agents; merged only by a human. |
| `identity(release)` | version, tag, commit and artifact digests, recorded once. A published tag is never rewritten; a correction is a new version. |
| `artifacts(release)` | build the targets whose status is `active`. A `reserved` target is not built, not run in CI, and not stubbed — it exists only as a declared entry in the delivery policy. |
| `publish(release, target)` | publish an `active` target **from the released tag, in the release pipeline, after a human merged the release**. An agent never runs a publish. A reserved target is refused, naming its status, so nobody builds a one-off path around the declaration. Registry credentials are provisioned by the human, never by the run. |
| `verify(release)` | live evidence for the released identity: pipeline result for that revision, artifact digest agreement, and the project's live acceptance. Each result carries its environment label; unavailable leaves the release unverified. |
| `notes(release)` | human-readable release notes generated from the accepted candidate's own changelog entry and measures, not from commit-message scraping. |

## Must never do

Merge the protected branch, create or move a published tag, publish to a registry, deploy, or
approve its own candidate. It also never widens acceptance: a release is built from a candidate that
verification already accepted, with the same digest.

## Publication targets are data

The delivery policy declares each target with a status:

```yaml
targets:
  - id: cli-tag
    kind: repository-tag
    status: active
  - id: npm-package
    kind: package-registry
    status: active
    registry: https://registry.npmjs.org/
  - id: container-ghcr
    kind: oci-image
    status: reserved
  - id: connected-runner
    kind: executable
    status: reserved
  - id: system-installer
    kind: debian-rpm
    status: reserved
```

Activating a target is an architectural decision recorded in the policy, not a code change that
quietly starts publishing. The container image keeps existing for **qualification** — it is how
native checks are run today — but a container must never be a prerequisite for completing a cycle,
which is the seam the execution contract already fixed.

## Invariants

| # | Invariant |
| --- | --- |
| I1 | One active release candidate at a time. A new version supersedes it; published tags and digests are immutable. |
| I2 | Targets are policy data with a status. A `reserved` target has no build step, no CI job, no stub and no configuration — declaring direction must cost nothing. |
| I3 | Agents prepare everything up to the protected-branch merge. Only a human merges, tags, publishes or deploys, and no flag converts that into an automatic action. |
| I4 | A release is identified by version, tag, commit and artifact digests, recorded once and derived everywhere else. |
| I5 | Release verification is live and environment-labelled. Staging, simulated or local evidence is never presented as proof of a release. |
| I6 | Version and changelog edits go through the ordinary checked-edit path and the ordinary verification gate. A release is a milestone kind, not a privileged workflow. |
| I7 | Nothing today installs or provisions a harness. Codex and friends are reached through the machine bindings the project contract declares; the installer targets stay reserved. |
| I8 | The container image remains an optional deployment and qualification environment; the CLI path completes without it. |
| I9 | Reserved targets are visible when a caller asks what the project can release, so the direction is not re-litigated, and absent from every build and CI run. |
| I10 | **The published package installs nothing and reaches nothing at install time.** No install or postinstall scripts, no network, no bundled harness. The package is the built CLI plus its runtime dependencies; Codex and friends are resolved through the machine bindings the project contract declares, and provisioning them is the reserved installer target's job. |
| I11 | Publication happens only from a released tag, in the release pipeline, after a human merged the release. A branch head, a dirty tree or an untagged commit cannot publish, and the published version records the tag, commit and package integrity hash it came from. |

## Acceptance scenarios

| Id | Given / when / then |
| --- | --- |
| RE-1 | `candidate` derives its range from the pinned previous release and the candidate head, and lists any included partial work for the maintainer instead of silently claiming it. |
| RE-2 | Version and changelog edits arrive as an ordinary issue-linked, verified candidate; a release PR cannot carry an unverified change. |
| RE-3 | `artifacts` builds only `active` targets; a `reserved` target produces no build step, no CI job and no stubbed output. |
| RE-4 | `publish` on a reserved target is refused naming its status; activating it requires a recorded policy change, not a code path. |
| RE-5 | A published tag is never moved or reused; a correction yields a new version with its own identity. |
| RE-6 | `verify` reports pipeline result, artifact digest agreement and live acceptance, each labelled with its environment, and an unavailable check leaves the release unverified. |
| RE-7 | Release verification run against a staging or simulated result fails this scenario rather than passing. |
| RE-8 | The CLI completes a full cycle — plan, build, checks, staging merge, tag — on a machine with no container runtime. |
| RE-9 | Nothing in the release path installs or configures a harness; a missing executable surfaces as the project contract's binding error. |
| RE-10 | `notes` are generated from the accepted candidate's changelog entry and measures, and disagree with no recorded verdict. |
| RE-11 | Two candidates cannot both be active: the second is refused with the first named, matching the single-lane rule. |
| RE-12 | A caller asking what this project can release sees every target with its status, and no target appears that the policy does not declare. |
| RE-13 | `npm pack` from a tagged release contains exactly the declared files — built CLI, runtime manifest, README, LICENSE, CHANGELOG — and installing that tarball into a clean prefix yields a runnable `arcnexus --version` with no network access and no install script executed. |
| RE-14 | Publishing from a branch head, a dirty tree or an untagged commit is refused; publishing from the released tag records the tag, commit and package integrity hash together. |
| RE-15 | A missing registry credential in the release pipeline raises a blocking question naming the external action required; it is never reported as a passed release and never retried blindly. |
| RE-16 | The package declares its engine range, and an unsupported runtime fails with the declared range named rather than failing somewhere inside execution. |

## Migration

| Current | Target | Effect |
| --- | --- | --- |
| Workflows run the entire suite on every push to staging and every pull request | fast static and owner-scoped checks gate a pull request; the full deterministic and native set runs on staging and nightly | removes the 25–37 minute per-push wall that dominated iteration cost, without weakening the assembled gate |
| Container image, AppArmor profile, generated seccomp policy and dedicated cgroup subtree as the qualification environment | retained for native qualification; optional for a cycle | matches the locked execution seam I14 and the container demotion in the delivery batch |
| No publishing implementation today; `package.json` is `"private": true` | public manifest with `publishConfig`, `files`, `bin`, `engines` and no install scripts; a release workflow that publishes on the released tag | the first active registry target; nothing else changes shape |
| Ad-hoc local image tags such as `arcnexus:phase2-fresh-337` | no release identity until `container-ghcr` is activated | stops treating a locally built image as a release artifact |
| `docs/release/verification.md` describing promotion and publication machinery | rewritten against this contract and the delivery contract | removes instructions for paths that no longer exist |

## Non-goals

Deploying external services, canary or progressive rollout, multi-architecture images, signing and
attestation, installers, telemetry, and any release automation that would merge a protected branch
or run a publish without a human — all of which stay reserved until their target is activated.

## Open questions for the architect

1. **Package name.** `arcnexus` on the public registry, or scoped as `@fractalsynapse/arcnexus`?
   This is the one decision that cannot be reversed cleanly later, and it is set by whichever
   registry location you create.
2. **Versioning scheme.** I propose semver straight from `package.json` with tags like `v0.1.1`, the
   changelog's `Unreleased` section becoming the release notes source, and `0.x` until the first
   qualified self-development cycle. Confirm, or name another scheme.
3. **Release verification depth today.** With no installer yet, I propose: pipeline result, published
   package integrity check, and a clean-prefix install-and-run smoke from the tarball, plus the
   project's live acceptance suite. Is the clean-machine smoke required to call a release verified,
   or nice-to-have until the installer target activates?

## Lock record

```yaml
id: arcnexus/release
stage: proposed
revision: 1
acceptedBy: null
acceptedAt: null
changes: null
```
