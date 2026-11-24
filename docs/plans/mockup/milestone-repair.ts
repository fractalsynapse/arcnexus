import type { Milestone } from './model.ts';
import { escape, icon, panel, pill } from './view.ts';

const milestoneRepairExamples = [
  {
    activity: 'review',
    sender: 'Milestone Review',
    subject: 'Add coverage for the staging conflict case',
    evidence:
      'Review finding · The regression test covers the normal merge and misses the conflict case in the milestone criteria.',
  },
  {
    activity: 'release',
    sender: 'Milestone Release',
    subject: 'Investigate the owner test failure after merging staging',
    evidence:
      'Staging integration check · Owner tests exited 1 on the merged candidate. Review the failing assertion before retrying the integration check.',
  },
];

export function milestoneRepairPanel(milestone: Milestone, activity: string) {
  const activities = milestone.steps.filter((step) => !step.inapplicable).map((step) => step.activity);
  const target = activities.indexOf('testing');
  if (target < 0) return '';
  const examples = milestoneRepairExamples.filter(
    (example) => activities.indexOf(example.activity) > target,
  );
  const preview = pill('Routing preview', 'quiet');
  if (activity === 'testing' && examples.length) {
    const messages = examples.map((example) => `<details>
      <summary>${escape(example.subject)}</summary>
      <p><strong>${escape(example.sender)}</strong></p>
      <p>${escape(example.evidence)}</p></details>`);
    return panel('Steward inbox', messages.join(''), preview);
  }
  const example = examples.find((entry) => entry.activity === activity);
  if (!example) return '';
  const title = activity === 'review' ? 'Action on review' : 'Action on release';
  const content = `
    <h3>Returned to Testing</h3>
    <small>From ${escape(example.sender)} · To <strong>${escape(milestone.owner)} steward inbox</strong></small>
    <p>${escape(example.subject)}</p>
    <details><summary>Failure evidence</summary><p>${escape(example.evidence)}</p></details>
    <div><button type="button" class="arc-button" data-activity="testing">${icon('inbox')}Open Testing inbox</button></div>`;
  return panel(title, content, preview);
}
