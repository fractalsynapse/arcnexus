import { ogsmGoal } from './ogsm-example.ts';

export const productionCandidate = {
  staging: 'staging-b',
  included: 'A, B',
  pr: 'Example production PR',
  head: 'example-prod-head-b',
  tree: 'example-prod-tree-b',
  base: 'example-main-base',
  merge: 'example-main-merge-b',
  tag: 'v0.4.0-example',
  goal: ogsmGoal.title,
  incident: 'example-release-incident-b',
};

export const releaseScenarios = {
  success: 'Successful release',
  'specialist-rejection': 'Specialist rejection',
  'post-release-failure': 'Post-release failure',
};
type Scenario = keyof typeof releaseScenarios;

const states = {
  ready: 'Ready for specialist reviews',
  rejected: 'Specialist changes requested',
  review: 'Awaiting final approval',
  held: 'On hold',
  'changes-requested': 'Changes requested',
  approved: 'Approved',
  merged: 'Merged · tag pending',
  tagged: 'Tagged · publication pending',
  published: 'Released · verifying',
  delivered: 'Delivered',
  failed: 'Released · checks failed',
};
type Phase = keyof typeof states;

const effects = ['approved', 'merged', 'tagged', 'published', 'delivered', 'failed'] as const;
const progression = [
  ['held', 'production-resume', 'Resume approval', 'review'],
  ['approved', 'production-merge', 'Simulate merge', 'merged'],
  ['merged', 'production-tag', 'Simulate tag', 'tagged'],
  ['tagged', 'production-publish', 'Simulate publication', 'published'],
] as const;
const decisions = {
  'production-approve': 'approved',
  'production-hold': 'held',
  'production-request-changes': 'changes-requested',
} as const;

let enabled = false;
let scenario: Scenario = 'success';
let phase: Phase = 'ready';

export function startProductionPreview(revision: string) {
  enabled = revision === productionCandidate.staging;
  scenario = 'success';
  phase = 'ready';
}

export function selectProductionScenario(value: string) {
  if (!enabled || !Object.hasOwn(releaseScenarios, value)) return false;
  scenario = value as Scenario;
  phase = 'ready';
  return true;
}

export function productionPreview() {
  if (!enabled) return;
  const reached = (effect: (typeof effects)[number]) =>
    effects.findIndex((entry) => entry === phase) >= effects.indexOf(effect);
  const next = progression.find(([from]) => from === phase);
  return {
    scenario,
    phase,
    status: states[phase],
    reached,
    action: next ? ([next[1], next[2]] as const) : undefined,
  };
}

export function recordProductionDecision(action: string) {
  if (!enabled || phase !== 'review' || !Object.hasOwn(decisions, action)) return false;
  phase = decisions[action as keyof typeof decisions];
  return true;
}

export function advanceProductionPreview(action: string) {
  if (!enabled) return false;
  if (action === 'production-reviews' && phase === 'ready')
    phase = scenario === 'specialist-rejection' ? 'rejected' : 'review';
  else if (action === 'production-checks' && phase === 'published')
    phase = scenario === 'post-release-failure' ? 'failed' : 'delivered';
  else {
    const next = progression.find(([from, input]) => from === phase && input === action);
    if (!next) return false;
    phase = next[3];
  }
  return true;
}
