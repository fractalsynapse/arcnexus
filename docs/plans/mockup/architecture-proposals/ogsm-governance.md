# Connect Objectives, Goals, Strategies, and Measures

**Direction agreed during UI review.** Plan and Run preview the governance model. Exact contract amendments and runtime adoption remain pending.

## Plan sets the objective and target

Keep the human Objective and its linked standing Goals in the approved guides. A quantitative goal specifies the outcome measure, unit, target, how the value is calculated, and the comparable population or conditions. Changes to the target or to what qualifies as success use the existing objective and goal approval. Plan joins the baseline and latest verified observation from run evidence. Component assignments and observed values stay in the run records. [Planner](../../../../packages/planner/contract.md)

## Run chooses a strategy and collects evidence

- Direction uses the gap to target and prior evidence to select a strategy, explain the choice, and assign milestones. Retain each strategy revision with the run plan and link it to the approved goal revision and the measures it is expected to move. The next Director can continue, revise, or retire a strategy using the evidence. [Direction](../../../../packages/direction/contract.md)
- Stewards choose tactics within the assigned milestone and can add diagnostic measures. A milestone shows the goal measures it affects, local diagnostics, and applicable quality checks. Changes to ownership, scope, or sequencing go through Direction using the existing plan revision path.
- The host records the measure definition and version, value and unit, relevant scope and inputs, measured candidate or staging revision, and evidence references. Derive values from observed operations or approved measurement sources. Show missing evidence as unavailable and distinguish candidate observations from verified staging observations. Changes to a measurement definition require a comparable baseline before interpreting a trend. [Workflow](../../../../packages/workflow/contract.md) · [Verification](../../../../packages/verification/contract.md)
- Report progress toward the standing goal separately from the verdict on a particular candidate. A candidate can deliver a verified improvement while the standing goal remains open. Each refinement round assesses relevant prior findings and considers whether to continue, revise the strategy, or record justified no change. Targets guide assessment within the existing execution and delivery rules.

## List-files example

Improve Planner efficiency while preserving decision quality. In the illustrative data, the baseline and latest verified result are 24 median `list-files` calls per Planner activation. The target is 12 or fewer. Direction's strategy is to reuse a file inventory within the activation. The steward compares the same planning requests under the same execution profile, counts calls from the host tool log, and checks that plans still cite the required files. The sample candidate reaches 16 calls with the quality check passing. Plan retains the verified value of 24 until comparable evidence is verified on staging.

## Adoption and acceptance

- Align the exact affected Planner, Direction, Workflow, and Verification contracts and update the plan template after approval. Extend the current evidence and plan revision paths so a later run can recover the strategy, measure definition, and evidence together.
- Verify that Plan can show a missing baseline, distinguish unavailable evidence from zero, and preserve the last verified reading when a candidate is measured. Compare the same input population and measurement definition across baseline and candidate. Verify that a measurement change leaves older results attributable to their original definition.
- Walk the example from the approved goal through the Director's strategy and steward evidence. Show candidate improvement that falls short of the target while the required engineering checks still pass. Verify that only a subsequent approved goal revision can change the target.

## Mockup review

Open **Goal progress** in Plan, then open **Reduce repeated Planner file discovery**. Follow **View strategy in Run** to **Strategy and Measures**, then open the `planner` assignment to see **Milestone measures**. The example is labeled throughout and uses illustrative values alongside the recorded refinement round.
