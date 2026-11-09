# Changelog

## [Unreleased]

### Changed

- Batch 4c, merge protocol: the integration sequence that decides whether bytes may move is now written once. Live and simulated publication each carried their own copy of the same dance — observe requirements, build the merge commit without moving the target, verify the **assembled** tree independently because a merge commit is a different tree from the candidate the assembly gate checked, require a pass backed by evidence, re-observe the target in case it moved while verification ran, re-assert authorization, compare-and-swap. `operations/merge-protocol.ts` holds that ordering; each provider supplies `gates`, `assemble` and `integrate` plus optional journaling hooks, so the simulated provider still records merge-in-progress, the verified assembled tree and a refusal that leaves `merged: false` on the receipt. Placed in `operations` rather than `publisher` because the simulated provider lives there — the compiler caught an import that would have made a lower layer depend on a higher one. Five new deterministic unit tests drive the protocol with a recording adapter and cover: ordering including the re-observation between verification and swap, a failed assembled check refusing without integrating, a target moved before assembly, a target moved during verification, and a pass carrying no evidence being an error rather than a silent green. This single-sources a safety property rather than shrinking line counts. (#366)

- Batch 4c, publication gate: simulation no longer approves its own review. `SimulationPublication` used to emit a `pull-request.review` effect carrying `decision: 'approved'`, and `SimulatedPullRequests` labelled it `reviewSimulation: true` — a synthetic provider review that the code itself documented as explicit. The merge gate now requires what the verification contract requires: the one independent gate, run with reviewer coverage, whose own reviewer evidence is captured on the pull-request record (`reviewerEvidence`). The review operation, its grant and its intent validation are deleted; a check that passes while carrying only the candidate's own record can no longer satisfy the gate, and that negative case is now tested. The simulated check also runs with `independent: true`, so the publication gate is the same verdict the assembly gate produced rather than a second weaker pass. Zero references to the synthetic review remain in `src` or `tests`. (#366)

- Batch 4c, collaboration provider: simulation now runs on the **evidence package** instead of an imaginary remote. The host's `UpstreamProvider` for `mode: 'simulation'` is `EvidencePackageUpstream`, and `simulated-upstream.ts` (100 lines) plus its fake-state database usage in the collaboration path are gone. The replacement keeps every guarantee the deleted code was checked for — idempotent apply with receipt reuse, begun-but-unreconciled work reading as `unknown` rather than `absent`, refusal to replay unreconciled work, idempotency-identity conflicts rejected, comments and closures required to reference an issue the package actually captured, and stale closures rejected against the captured revision — and makes isolation structural: no HTTP client, no credential, one namespace per package. `provider-store.ts` remains only for the publication twins. 23 pass locally across the evidence-package, upstream-execution and collaboration-progress suites, with the recovery and cancellation cases converted rather than removed; `validate` exit `0`. (#366)

- Answered the architect's question in the affirmative: `--simulate` **stays**. Simulation keeps its mode, so retiring its selector would leave a lifecycle with no way to reach it. The CLI gateway contract is revised to revision 3 and now delivers `task run --simulate`, selecting the evidence-package collaboration provider — the real lifecycle with no upstream. It is removed from the rejected-option list and from the retired-command table, and GW-21 asserts the flag cannot be chosen by an agent mid-run. Added the proposed **collaboration-provider** contract: the seam the architect wants to keep for future forges — four operations (tracking, comment, review, release) with two providers, `github` and `evidence-package`, one engine, and the rule that simulation captures rather than imitates: real issue text, real diff, real check results, real verdict, and no upstream client to refuse. (#366)

- Cleanup batch 4, slice 4a+4b: simulation-to-live promotion is **deleted**, not redirected. Gone: `delivery promote` and `delivery publish` CLI commands, `ExecutionControls.promote`, `promotion-control.ts`, `run-promotion.ts` (236), `run-continuation`'s promotion branches, `promotion-review.ts` (131), `promotion-recovery.ts` (46), `operations/promotion-assembly.ts` (200), and the four suites that exercised them (~700 test lines). The shared `PromotionFixture` is renamed `PublicationFixture`, because a promotion-named fixture in a tree with no promotion is exactly the legacy vocabulary that should not survive. Authorized by three locked contracts — the MVP plan defers promotion qualification, the delivery contract requires one publication route, the release contract keeps container and runner targets reserved. Publication itself is unaffected: the host advances it automatically, and `delivery approve` stays because the publish-delivery operation carries no `automaticMerge` grant, so it is currently the only way a human records approval for a candidate revision. Found and recorded before cutting: `delivery approve` and `delivery publish` are listed as retired in the gateway contract but **cannot retire yet**, because `task answer` resolves run questions only and `DeliveryResources.approve` is the sole path that records a human approval for a candidate revision, which publication requires. Retiring them now would strand the human gate rather than unify the route. (#366)

- Split the CI gate into tiers so a pull request stops waiting on the slowest one. Measured on a recent run: 36m46s total, of which native host qualification is 21m20s, the deterministic built-program suite 13m40s, and all statics about two minutes. Development PRs now run statics plus the deterministic suite (`native: false`); the native tier gates staging pushes, main, published releases, and a new nightly/manual dispatch that qualifies `staging` explicitly. No suite is deleted and no tier is dropped overall — a change still cannot reach staging without native qualification — but the time to first real error drops from about 37 minutes to about 16. The release workflow test that required the native step to be unconditional now requires it to be caller-selected with a `true` default and present on staging, main, releases and nightly, so native coverage cannot vanish — it can only be deferred one tier. (#364)

- Cleanup batch 3, step 3a: the acceptance path now carries one content-addressed verdict instead of a mitigation cache. `DeliveryChecks` records a `verdict` bound to the candidate digest and the captured input key, exposes it as a readable `verdict(head, independent)` rather than an internal `retained()` reuse of a re-run, and goal acceptance reads that verdict instead of calling the gate again. The reuse rule moved out of a ten-clause inline boolean into a named pure predicate, `verdictAgrees`, so the single-gate semantics are testable on their own: identical bytes and inputs reuse, any change to source, authority, environment, goal or accountable acceptance invalidates, a verdict without reviewer coverage is never reused by a gate that requires it, and a verdict whose workspace, evidence or artifacts vanished is invalid rather than trusted. The `acceptedChecks` field is gone. Six deterministic unit tests anchor VI-5 and VI-6; the native gate suites that exercise the path end-to-end are skipped locally and reported by CI (#361).

- Locked the release contract with the architect's answers, verified against npm's own documentation: the unscoped name `arcnexus` is supported and currently free on the registry (unscoped packages are always public and need only an npm account), versions are plain `<major>.<minor>.<patch>` with **no `v` prefix** so tag, manifest and published version are one identical string, publication runs from a released tag through npm trusted publishing on GitHub-hosted runners with no long-lived token in repository secrets, and a release is not verified until the published package has been installed from the registry into a clean prefix on a machine that never had the repository. Two operational constraints are recorded because they change the order of setup: a new trusted publisher expires unless its first publish succeeds within two days, and trusted publishing does not support self-hosted runners. Post-release verification is required; the reading of that requirement is flagged in the contract for correction. Active targets are the CLI tag and the npm package; container, connected-runner and installer targets stay reserved as policy data with no build step, CI job or stub (#360).
- Locked the delivery contract and proposed **release**, with the architect's scope correction applied: publication today is the CLI plus an **npm package**, and container, connected-runner and Debian/RPM installer targets stay **reserved as policy data** rather than becoming code, CI jobs or stubs. Delivery now states that the provider performs the merge and returns its identity, that the only human gates are a production release and a blocking question needing an answer or external action — so an uncertain upstream outcome is reconciled by observation before it can become a gate — and that agents never run a publish themselves. The release contract adds the packaging guarantees that matter for a public npm target: no install or postinstall scripts, no network at install time and no bundled harness, publication only from a released tag with its commit and package integrity recorded, an engine range that fails with the range named, and eleven invariants with sixteen scenarios (#360).
- Proposed the **delivery** contract, the only component that talks to an upstream, written against the defect that actually ended the last real attempt: the publisher chose the candidate from a verification checkout as its publication parent instead of the retained assembly base, producing a pull request with the wrong ancestry, and the existing regression missed it because it was built from an assignment-shaped record. The contract fixes the engineering baseline as the retained assembly base and requires its regressions to use the actual production assembled record; makes staging integration automatic with production release as the only human gate and no configuration that turns the gate into a merge; requires one publication route, observed rather than assumed upstream effects, one recorded merge identity, and release verification that is live or nothing. It retires the promotion subsystem, the simulated twin engine, the provider receipt store and the external-effect ledger — ~3,693 lines toward 900-1,200 — with sixteen scenarios (#358).

- Locked the verification contract at revision 2 with the architect's rejection of caps: the first system imposes **no size, count, attempt or duration limits** because limits have historically cost time and lost work. Evidence bundles are assembled in full with artefacts carried by reference and read on demand, every bundle is measured (bytes, item count, largest contributors, reviewer token use) so a future limit can be placed on evidence rather than instinct, and an external harness that cannot accept an input becomes an `unavailable` check with its byte count instead of trimmed content. Replacing the paging subsystem with references removes the 56,273-repeat-call pathology without removing any information (#357).

- Locked the direction contract and proposed **verification**. Direction now states that staging integration is an ordinary automatic milestone completed when checks, CI and any configured review requirement pass, and that only production release — protected-branch merge, tag, publication, deploy — awaits a human gate; a locked-contract conflict inserts a change-request gate into the plan so the blocked decision is visible; and the `stewardship` directive shape is reserved rather than deferred silently. The proposed verification contract fixes one meaning of `passed`: a single checklist run on the assembled candidate, one independent reviewer covering engineering criteria and goal acceptance, evidence bounded where it is produced with an over-cap bundle reported against the producer instead of paged or truncated, digest-keyed reuse, content-addressed verdicts, and expected-red regressions counted as passing verification. It retires the per-owner re-verification chain, the promotion review, the characterization re-check and the paging readers — ~2,156 lines toward 600-800 — with sixteen scenarios (#357).

- Proposed the **direction** library contract: plan generation from the locked template, owner selection from a bounded catalog index, deterministic sequencing where a request becomes the preceding milestone, correction as an ordinary next milestone, the task/workday directive seam, clarification gates, and a pre-admission contract check that turns a locked-clause conflict into a change-request gate instead of a milestone. It fixes what direction must never do — it orders work, it does not execute, judge, publish or store it — and maps ~2,456 lines scattered across five components (admission, retirement, required work, run and workday selection, collaborative dispatch, a second workday planner, a ~2,500-character prohibition paragraph) toward roughly 800 lines of planning with sixteen acceptance scenarios (#355).

- Contract enforcement is now code, not intent. `arcnexus validate` reads `docs/interface/registry.yaml` at the validated revision and recomputes every recorded contract digest, reporting stable findings for a mismatch, a locked record without acceptance or digest, a missing file or an unknown stage; a project with no registry declares nothing and stays valid. Checked edits are refused before ownership is consulted when the target is a locked contract — so a component owning its own contract still cannot edit it while locked — and the registry itself is refused while anything is locked. Locks are captured from the run's base revision, so editing the registry inside a workspace unlocks nothing for the run that did it; the rejection names the contract and returns the counter guidance instead of a bare error. Six new suites cover each finding code and each refusal case, and the new check immediately caught a duplicate top-level key in the registry that strict YAML parsing rejects (#353).

- Locked the execution contract at revision 2 with the architect's answers: bubblewrap in-process is the only required confinement mechanism while the container stays an opt-in deployment seam, and the lane, workspace and confinement interfaces must not preclude a background host running several goals at once (new invariant I14 with scenario EX-19, which forbids process-global lane state); the lane belongs to execution and plan ordering to direction; harness state stays per activation so one activation cannot inherit another's thread history. Six locked contracts plus the protocol now stand between the gateway and durable memory (#352).

- Locked the coordination contract and proposed **execution**. Coordination records the architect's answers with one amendment: a goal is identified by the **digest of its text**, the store is authoritative with the committed plan as a deterministic render, per-goal retention removes only regenerable caches and never authored evidence, and entities plus events — fourteen invariants and nineteen scenarios retiring seven databases, three lock files, ten JSON mirrors, 101 state literals and the 4,288-line recovery subsystem. The proposed execution contract fixes the lane, workspace, checked edit, activation, operation execution, confinement, snapshot, assembly, cancellation and progress services, carries the locked-contract refusal that gives the whole walk its teeth, requires one context generator shared with `inspect`, and maps the daemon, scheduler, promotion, twin transports and rescue modules to deletion — 14,941 lines across five absorbed components toward roughly 4,000 (#352).

- Locked the architecture-model library contract and opened the coordination contract. The protocol now records the architect's ownership rule — each contract file belongs to the component it describes, held by architecture-maintenance until that component exists — and `docs/interface/arcnexus-foundation.md` and `arcnexus-cli-gateway.md` moved to the foundation and CLI owners accordingly. The proposed **coordination** contract fixes durable memory: one store per project with a single writer, nine entity kinds, eighteen state literals replacing 101, derived reports instead of co-written projections, gates and requests as records rather than statuses, recorded measures, and sixteen scenarios that retire seven databases, three lock files, ten JSON mirrors and the 4,288-line recovery subsystem (#351).

- Opened the libraries stage with the proposed **architecture-model** contract: the catalog, ownership, import boundary, validation, admission capture, bounded activity context, operation resolution, bindings and change proposals that every other component reads. It absorbs `guidance-validation`, deletes the eight migration modules, the v4/v5 readers and the legacy schema families along with the architecture constraints that currently make deleting them a policy violation, and takes the component from 49 files and 5,754 lines to about ten modules and 1,200–1,400. It also adds the two checks that turn the contract walk into enforcement: locked-contract digest verification in validation, and refusal of any checked edit targeting a locked contract without recorded human authority. Sixteen acceptance scenarios (#349).

- Locked the CLI gateway contract at revision 2 with the architect's decisions: `arcnexus inspect [project] [component] [activity]` previews the complete generated agent context through the **same generator a live activation uses**, with named placeholders where runtime data would go and no model call, host start or state write; per-command options now live with their commands and only `--json`, `--help` and `--version` are global; `plan show` folded into `task status` under a new one-fact-one-command invariant; and foreground `task run` prompts at human gates while `--async` never does. Twenty acceptance scenarios now anchor the gateway cleanup (#347).

- Lock the contract protocol and the Project and Foundation contracts, and add the proposed CLI gateway contract: 13 delivered subcommands, 4 reserved names, 8 retired command families, 15 accepted options, a bounded output and exit-code contract, and 14 acceptance scenarios that become the tests driving cleanup. Agents must now validate any codebase-changing request against the relevant contracts and counter a conflicting request to the architect before acting — stated in the protocol, `AGENTS.md`, the release procedure and the plan template. Work branches become `<issue>-<description>`: a branch names the work, never the tool performing it (#345).

- Start the contract-first pass: `docs/interface/` records component interfaces with `draft` → `proposed` → `locked` stages, where a locked interface changes only on recorded human authority and its acceptance scenarios drive the later cleanup. Added the contract protocol, the **Project** contract (replacing the platform and package pair along with composition profiles, environment configuration and portfolio registration) and the **Foundation** contract (stable commands, quality rules, generated-output policy, one build route), both submitted as `proposed` for the architect to lock, plus a registry recording stage, revision and digest. Charter and guidance adopt Project and point to the protocol without duplicating it (#345).

- Record the accepted MVP architecture and the `.arc` knowledge structure: architecture, plans and learning separated by author; goals planned by the director as sequential single-owner milestones from a shared plan template; the five Steps as the only activity vocabulary with per-activity standards and execution profiles; one store, one process, one verification gate, one publication route and one configuration version; a task/workday seam; and `verify-release` defined against live CI/CD and hosted acceptance. Documentation and direction only — the runtime still behaves as described below, and no cycle is claimed. Guidance no longer conflicts with stating acceptance as a failing test before a behaviour change (#343).

- Align shared agent skills with Scaffold and keep ArcNexus guidance and its reference experiment in project-owned skills (#341).

- Reuse an explicitly linked accepted supplier assignment without copying its objective or acceptance criteria verbatim; preserve its owner, contract and workflow, validate identity, owner, run membership, replay and cycles, and create separate assignments for distinct work. Cross-owner edit rejections guide stewards to inspect assignment evidence and link matching work, keeping accepted intent distinct from verified delivery (#339).

- Focus the MVP on fresh real task delivery through staging, with canonical director, ownership and contribution-routing rules and deferred historical recovery (#337).

### Fixed

- Publish assembled task changes from their independently reviewed engineering baseline instead of the architectural revision or verification checkout (#337).

- Qualify complete director catalog paging instead of rejecting catalog growth against an obsolete inline-prompt size assertion (#325).

- Wait for observed host readiness and preserve caller cancellation across task, workday, and delivery controls instead of failing slow startup after a fixed window (#285).

- Resume settled promotion check failures without recreating tracking or assembly, retain actionable diagnostics, and release failed dependency-cache builds for ordinary retry (#319).

- Use one assembled verification and correction loop for steward contributions and the task goal; reuse unchanged acceptance during publication, preserve ownership, and route peer feedback through existing requests (#312).

- Share authoritative execution evidence across direction, engineering, recovery and verification, preserving caller input, dependency identities and terminal pagination (#308).

- Route actionable failed change reviews into the existing implementation correction checkpoint without accepting incomplete work (#309).

- Retire settled obsolete dependency work without requiring its failed supplier to be resumable, while preserving execution and uncertainty checks (#304).

- Retire obsolete dependency requests through ordinary director admission while preserving shared work, checkpoints and history (#275).

- Reclaim terminal dependency copies automatically and bound evidence retention with a configurable ceiling and oldest-first expiration to 50%, preserving active work and pending deliveries (#302).

- Let engineering stewards retrieve complete retained operation diagnostics through the existing assignment evidence capability (#290).

- Retire stale routing failure receipts and recognize reconciled routing during validated resume, preserving loop and uncertain-operation checks (#296).

- Preserve complete large evidence responses and fragmented Unicode over the shared MCP bridge (#294).

- Use canonical repository templates for readable live and simulated issues and PRs, preserving retry identities and separate verification evidence (#293).

- Temporarily use Sol for research, direction and independent review, with recorded host substitutions for retained testing runs (#291).

- Use the verified candidate test baseline while preserving captured check authority and current implementation (#287).

- Remove the evidence reader size ceiling so agents can request complete artifacts without repeated rejected reads (#286).

- Accept architect feedback on safely paused tasks through the existing answer control (#283).
- Keep verification and recovery indexes compact while retaining detailed evidence as independently readable artifacts (#279).

- Observe native test host shutdown without racing process disappearance (#280).

- Keep worker regression checkpoints as review evidence so incidental test corrections do not redefine product acceptance (#273).

### Changed

- Reserve research for substantive questions; keep routine code discovery and evidence lookup within the engineering activity that needs them (#277).

- Require verified director/steward self-repair within existing authority as part of the self-development lifecycle (#275).

- Reuse settled dependency preparation across task/workday workspaces while keeping installed dependencies read-only and build outputs isolated (#268).

- Recover retained tasks through the installed runtime and one host launcher, recording runtime transitions without per-run supervisor copies (#266).

### Added

- Select inherited steward activity profiles per model turn while preserving one workflow, captured authority and separate independent verification (#277).

- Publish each steward’s verified development branch through staging in delivery order, retain branch ancestry across dependencies, and reuse completed workday deliveries (#248).

- Archive historical runtime indexes in application evidence storage and remove their maintained repository copies (#250).

- Give independent publication reviewers access to the captured assembled check outputs and supplier evidence (#249).

- Snapshot GitHub staging when a simulation starts. Each steward works on its own development branch, and the host rejects incompatible baselines before dispatch (#247, #248).

- Pin real promotion to the GitHub target branch revision and require its publication grant before admitting live work. Refuse a merge that would import unreviewed base history (#247).

- Rank the complete eligible steward catalog for task direction. Starting teams follow the goal, and committed inbox activity wakes an idle scheduler without repeated catalog scans (#148, #242).
- Accept all component-owned file types at specification checkpoints while still requiring classified documentation and regression evidence. Show directors which failed assignments can resume, and let stewards correct missing final checklist evidence (#243, #245, #246).

- Return incompatible existing-supplier requests to the steward for correction before any inbox action commits (#241).

- Let task directors explicitly replace diagnosed failed change assignments. Preserve predecessor evidence, correlated requests and original criteria through verified successor delivery (#235).

- Keep a rejected stewardship decision and its evidence with the scheduled owner so unrelated workday activations can proceed (#240).

- Validate unused standards during architecture validation and reuse each standard across its inheriting stewards (#148).

- Identify the accountable steward when a checked edit crosses ownership and guide the requester through an inbox handoff without granting writes. Remove assignment file lists: only the accountable component steward selects implementation files (#239).

- Migrate platform or package registrations to compatible existing repositories through supervised materialization without pushing or modifying the original checkout (#238).

- Persist the complete director decision and workflow checkpoint atomically before dispatching its assignments (#235).

- Fetch locked HTTPS dependencies serially with curl, cache their archives locally, and install offline with npm integrity checks inside confinement (#237).

- Keep collaboration acceptance portable inside steward confinement by separating catalog fixtures from native host setup, without adding skipped checks (#236).

- Project dependency waits and verified/blocked assignment milestones onto authorized tracking issues with durable, nonduplicating recovery (#233).

- Expose current-run assignment intent through read-only evidence so stewards can discover and deliberately link existing work without private checkpoint access (#231).

- Expose hash-validated same-run investigation artifacts through the independent verifier manifest, preserving explicit missing evidence and rejecting foreign or altered files (#220).

- Index full verification command logs as separate immutable artifacts so reviewers can retrieve relevant output without scanning unrelated logs (#219).

- Return corrective feedback for invalid evidence artifact requests without terminating review or exposing foreign content (#218).

- Share typed equality filters across platform and package lists, including explicit package namespace selection (#148).

- Retain structured operation stdout separately from diagnostic warnings, preserving complete checked-edit proposals and supervised output bounds (#217).

- Consolidate preparation, cleanup, status and following under workspace services, removing the duplicate gateway execution path while preserving historical readers and detach-only following (#148).

- Preserve captured execution progress and event-sensitive revisions in workspace resource views without exposing raw harness records (#216).

- Apply complete retained operation edit proposals by invocation reference through the checked edit tool, avoiding truncated formatter JSON while preserving source-write enforcement (#214).

- Return application-settings revisions and reject stale service updates under exclusive persistence ownership, preserving environment overrides and simple config commands (#213).

- Check captured mandatory source quality before freezing behavioral regressions, retaining specification correction without weakening frozen-test authority (#212).

- Give research/review assignments pinned current-run checkpoint, checked-edit and operation evidence through a read-only MCP capability, including director and caller clarification (#207).

- Queue simulation promotion under fresh real-target authority with independent target and goal verification, retained source provenance, and existing live publication gates (#148).

- Explain supplier-assignment identities and retain invalid links as actionable dependency blockers without stopping unrelated work (#209).

- Retain reviewed candidate record identities and revalidate original delivery attribution and independent evidence before promotion (#148).

- Classify host IPC admission tests in native qualification and detect direct socket factories before they can break confined steward baselines (#208).

- Assemble attributed simulation changes against a current target without importing unrelated baseline history or changing source branches; retain conflicts for inspection (#148).

- Show current frozen regression paths and hashes on every steward turn, with explicit guidance for additional tests without weakening checked edits (#206).

- Package an immutable headless container supervisor with scoped startup delegation, capability-free init and execution, qualified native confinement and graceful project-host drain (#148).

- Reject malformed checked-edit requests with corrective feedback before any source mutation, while retaining fatal authority and recovery failures (#205).

- Drain managed execution and persist interruption on host shutdown without falsely rejecting dependent work (#148).

- Connect live delivery commit, fresh verification, push and GitHub PR creation to the coordinator with durable effect reuse, refreshable provider gates and independently verified exact-target staging integration (#148).

- Manage platform standards through checked create/update/remove configuration transactions with stale-revision and reference protection (#148).
- Return observed failing checks to stewards despite diagnostic prefixes while retaining fatal mandatory verification, cancellation and uncertain execution (#203, #210).
- Add isolated, supervised GitHub delivery transport for verified host commits with exact-head recovery and scoped credentials (#148).
- Create/remove executable components through validated configuration transactions and observe exact-head GitHub PR readiness without conflating approval, review and CI (#148).

- Prepare locked dependencies sequentially before confined offline installation and identify failed operations with retained diagnostic logs (#148).

- Add durable simulated Git/PR/release publication, delivery inspection and revision approval, and confined read-only dependency downloads with native bypass qualification (#148).

- Route simulated tasks/workdays through isolated repositories and assignment-bound collaboration, direct workday setup, and retain revision-bound verified deliveries before publication (#148).

- Add durable environment-bound collaboration intents, conservative upstream recovery, and GitHub/simulated issue adapters for the pending managed lifecycle (#148).

- Update registered component, platform and package definitions through recoverable configuration commits without editing caller checkouts (#197).

- Clean up eligible package workspaces outside a checkout while retaining unfinished work and execution evidence (#195).

- Prepare registered package workspaces outside a checkout through shared services and exclusive repository ownership (#191).

- Expose complete committed platform standard list/get resources, including unused guidance (#187).

- Read registered package components through shared list/get services with safe projections, filters, cursors and revision tokens (#173).

- Target configuration migration at registered platforms or packages from outside a checkout (#167).

- Expose read-only workspace list/get/follow resources with revision tokens and package targeting (#160).

- Start registered workdays and control retained identities from outside a checkout; status reads no longer start a host (#148).

- Manage retained tasks by identity, submit asynchronously or target registered packages, and recover through hash-validated captured supervisors (#148).

- Query and follow retained tasks and workdays without a checkout or running host (#148).

- Inspect registered package architecture and prompt context without starting engineering (#148).

- Target registered or local packages with `test inspect/run` and explicit component selection through the shared test executor (#148).

- Materialize existing repositories into the project volume with supervised Git, recoverable registration, and local-only repository identity (#148).

- Register existing platforms and packages in a persistent project volume with qualified identities and non-destructive removal (#148).

- Migrate active component standards to schema six while preserving historical pattern evidence (#148).

- Include tracked agent guidance findings in architectural validation without requiring optional skills (#148).

- Validate minimal version-five component declarations with inherited policies, derived ownership and file classification, shared operation plans, and checked-edit runtime foundations (#109).

- Run prompt-driven tasks and persistent workdays with dynamic owner assignments and retained candidate evidence (#78).

- Derive component ownership, package identity, standards and contracts from version-four definitions (#71).

- Initialize component-led tasks and report progress without implicit execution quotas (#65).

### Fixed

- Keep worker checklists as progress evidence instead of requiring host delivery before engineering handoff; recover completed diagnostic checkpoints without replaying uncertain execution (#269).

- Give promotion directors retrievable target-check evidence and a distinct live-promotion goal while preserving source acceptance and provenance (#265).

- Page complete steward review evidence instead of embedding large patches in model input (#262).

- Measure the production shared catalog in context-size acceptance while preserving its existing safeguard and authority checks (#260).

- Admit same-package simulated tasks against the active host's captured identity without recapturing advanced upstream staging (#259).

- Preserve the primary execution-store error when SQLite rollback also fails after storage exhaustion (#258).

- Reject new live promotions before task creation when the execution host lacks its GitHub credential (#256).

- Preserve validated diagnostic checkpoints after completed worker failure responses while still refusing uncertain operations (#254).

- Admit diagnosed workday assignment successors through the same ownership, acceptance and checkpoint checks used for tasks (#253).

- Remove the workspace steward’s obsolete prohibition on its component-owned definition; retained runs keep their captured authority (#252).

- Identify frozen acceptance failures in steward corrective and review feedback (#251).

- Reject infeasible behavioral scopes early and return observed specification and characterization deficiencies for correction (#235).

- Page complete director catalogs, retained checkpoint state and assessment input through immutable evidence tools, preventing large histories from overflowing initial prompts without restricting eligible owners (#230).

- Return invalid dependency scope to the requester before creating recipient work; reject behavioral assignment scopes disconnected from the captured test-profile root before workspace preparation, preserving explicit scope and nonbehavioral workflows (#229).

- Preserve original delivery attribution when a workday inherits a verified task candidate, without duplicating publication or stopping unrelated work (#227).

- Give explicit simulated publication retries fresh check observations while retaining failed receipts, deduplicating pending requests and refusing uncertain-operation replay (#228).

- Validate proposed new test registrations, owner and source layout before checked edits, returning corrective feedback without partial writes (#226).

- Reject captured test-selection changes before checked source mutation, allowing stewards to correct proposals without terminating otherwise valid work (#225).

- Resolve confined command and service executables against their actual PATH before dispatch, preserving absolute runtime identity and executable aliases in containers (#223).

- Package a compatible pinned Bubblewrap for real Codex startup while retaining private-client and source confinement (#222).

- Distinguish frozen-regression preservation from the earlier Git diff during review, and inherit mandatory source quality once for every ArcNexus steward (#221).

- Return observed compiler-prerequisite failures as corrective agent feedback without running dependent checks or weakening mandatory verification (#210).

- Preserve confined subprocess input and exit status with deny-all proxy enforcement, remove stale compiled tests, and deduplicate director context without narrowing eligible owners (#148).

- Close retiring-host mutation admission and preserve nonterminal tasks before releasing execution ownership (#199).

- Correct component access guidance through real stewardship, distinguishing current checked edits from historical writable-directory probes (#189).

- Reject malformed ordinary component test fixtures before missing-behavior assertions (#184).

- Preserve specification continuation after an invalid regression operation selection without granting agent-only verification authority (#181).

- Let stewards correct rejected checklist tool claims without aborting valid engineering; retain loop diagnosis and fatal execution safeguards (#178).

- Isolate steward client tools and authentication from personal MCP, app and plugin configuration; validate effective capabilities before inference (#174).

- Preserve installed runtime layouts and surface launcher errors in native qualification fixtures (#176).

- Include previously omitted runtime enforcement suites in native CI qualification (#170).

- Run consolidated architecture and guidance validation during steward verification (#165).

- Keep read-only portfolio discovery stable during concurrent database initialization (#162).
- Refuse cleanup of clean workspaces retained by general tasks, workdays or assignments before any removal effects (#158).

- Stop shared native-test supervisors before removing fixture evidence, preserving diagnostics if shutdown fails (#156).

- Follow the transferred ArcNexus upstream at `fractalsynapse/arcnexus` in active configuration and repository links (#148).

- Preserve captured dependency states and verified delivery context when engineering resumes under the shared scheduler (#147).

- Derive root-owned inventories from actual tracked files and validate generated outputs in each operation’s repository (#145, #146).

- Keep implicit definition ownership anchored to its catalog repository and validate every bound minimal repository (#143).

- Reject legacy environment recipes before starting a new minimal task or workday host (#142).

- Reject obsolete execution budgets before applying a configuration migration (#141).

- Preserve future owned paths in minimal read-only activations, valid pending operations after rejected selections, and declared repository identity in campaign clones (#138, #139, #140).

- Keep one canonical project host when temporary-storage or evidence-root settings change (#137).

### Changed

- Make simplification and three consecutive real self-development cycles the MVP baseline; defer scope expansion and permit ordinary recovery without frozen supervisors (#266).

- Use owner-scoped engineering checks and retain full repository verification on assembled deliveries (#234).

- Move scripted prompt-campaign execution into acceptance-test support and retire `experiment run`; real-agent simulation continues through tasks and workdays (#148).

- Batch related implementation and test authoring before long qualification cycles; preserve final release gates and real director-selected self-development (#148).

- Keep new execution state inside the configured project volume while retaining explicit access to historical state (#193).

- Align the charter with the accepted managed lifecycle, real-agent simulation and pre-phase-three API/UI prerequisites (#148).

- Clarify confined and native qualification with a real steward-produced, independently verified documentation change (#164).

- Use one durable assignment dispatcher and source-read-only model path; reject historical execution budgets and initialize through shared confined operations (#109).

- Route command, HTTP and service execution through shared operations, rejecting legacy executable definitions while retaining historical evidence readers (#109).

- Require minimal version-five authority for new task/workday hosts, workspace preparation and shared-operation test execution; preserve historical inspection and explicit migration (#109).

- Retire component, fixed-owner workday and proposal execution commands; preserve historical inspection and route prompt campaigns through the shared host (#106).

- Enforce readable class/method structure and separate delivery verification lifecycles (#73).
- Align component directories and CLI adapters with ownership and shared test selection (#72).

- Compile class-based TypeScript tests and enforce compact owner-scoped code quality (#64).

- Read YAML configuration and group implementation by accountable owner (#63).

### Added

- Qualify two-owner workdays with declarative experiments and real guidance self-management (#60).

### Added

- Coordinate two stewards through verified workday handoffs (#57).

### Added

- Inspect durable two-owner workdays and checkpoint steward execution (#56).

### Added

- Run declarative simulated and live experiments through the supervised runtime (#53).

### Added

- Own agent guidance and validate tracked instructions through the TypeScript CLI (#51).

### Fixed

- Reconcile interrupted cleanup, validate operation compatibility and expose coordination evidence (#50).

### Added

- Capture selected prior evidence and qualify planned steward operations (#48).

- Probe steward capabilities and supervise local HTTP service leases (#45).

- Expose captured engineering operations with bounded host feedback (#42).

- Capture steward assignment plans, checklists and a live execution timeline (#41).

### Added

- Summarize captured workflow activities and outcomes in Markdown reports (#32).

- Run repeatable single-steward qualification campaigns with retained acceptance evidence (#32).

- Prepare composed workspaces with pinned read-only repository members (#32).

- Host-check the single-steward engineering workflow (#31).

- Validate architecture definitions and inspect resolved assignments (#30).

- Add opt-in bounded corrective attempts on the same steward thread (#25).

- Require explicit component read and write directory policies (#24).

- Capture steward execution contracts and enable research with explicit verification handoff (#23).

- Preserve the development journey and phase-one lessons (#18).

- Show sorted changed files in execution reports through self-development (#13).

- Add repeatable live coding acceptance and self-development definitions (#11).

- Execute one component steward through the Codex SDK (#9).

- Add application-managed workspaces and environment preparation (#7).

- Add initial repository validation CI (#3).

### Fixed

- Supply executable and revision context to bounded stewards (#38).

- Record qualification evidence and correct failure diagnostics and ownership (#32).

- Inspect staged and unstaged candidate changes independently (#22).

- Preserve execution evidence during workspace cleanup (#16).

### Changed

- Default steward execution to Luna (#20).

- Resolve guidance edge cases for self-development (#5).

- Align ArcNexus guidance with iterative self-development (#1).
