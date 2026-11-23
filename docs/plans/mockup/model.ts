import { decodeBase85 } from './base85.ts';
import { previewTopics } from './file-topics.ts';
import { ogsmGoalFile } from './ogsm-example.ts';

export type Area = 'plan' | 'architect';
export type Workspace = Area | 'run' | 'release';
export type EventRow = [
  time: string,
  kind: string,
  label: string,
  detail: string,
  id: number | string,
];
export type RunEvent = [
  run: number,
  component: string,
  activity: string,
  milestone: string | null,
  row: EventRow,
];
export type ArtifactRef = [directory: number, file: string];
export type ToolCall = [
  name: string,
  actor: string,
  activity: string,
  time: string,
  refused: boolean,
  input: number,
  output: number,
  flags: number,
  request: ArtifactRef,
  response: ArtifactRef,
];
export type Revision = {
  id: string;
  name: string;
  updated: string;
  updatedAt?: string;
  priority: number | null;
  topics: string[];
  content: string;
  restore?: [number, number, string[]][];
};
export type DesignFile = {
  area: Area;
  type: string;
  path: string;
  capture: string;
  revisions: Revision[];
};
export type IndexedFile = DesignFile & { id: number; latest: Revision };
export type Filter = { type: string; sort: string; query: string; topics: string[]; changed: boolean };
export type Stats = {
  state: string;
  last: string;
  nativeDuration: string;
  input: number | null;
  output: number | null;
  cached: number | null;
  reported?: number;
  activations?: number;
};
export type Activation = {
  sequence: number;
  component: string;
  activity: string;
  milestone: string | null;
  revision: string;
  at: string;
  end: string | null;
  input: number | null;
  output: number | null;
  cached: number | null;
  ms: number | null;
  profile?: string;
  model?: string;
  reasoning?: string;
};
export type PlanStep = {
  activity: string;
  inapplicable?: string;
  checklist: { id: string; expected: string }[];
};
export type Milestone = {
  id: string;
  owner: string;
  criteria: { id: string; description: string }[];
  steps: PlanStep[];
};
export type Plan = {
  seq: number;
  purpose: string;
  objectives: string[];
  constraints: string[];
  milestones: Milestone[];
};
export type Review = {
  kind: string;
  seq: number;
  candidate: string;
  at: string;
  run: number;
  criteria: string[];
  checks: [string, number | null, number][];
  findings: { owner?: string; criterion: string; reason: string; evidence: string[] }[];
  action: { milestones: [string, string][] } | null;
};
export type ReleaseCheck = {
  name: string;
  state: 'passed' | 'pending' | 'failed' | 'unavailable';
  detail: string;
};
export type ReleaseEvidence = {
  prChecks: ReleaseCheck[];
  externalReview: ReleaseCheck;
  postMerge?: { commit: string; checks: ReleaseCheck[] };
};
export type ReleaseCheckpoint = {
  seq: number;
  milestone: string;
  base: string;
  commit: string;
  branch: string;
  checks: ReleaseCheck[];
  issueComment: string;
};
export type RunRevision = {
  kind: string;
  seq: number;
  run: number;
  at: string;
  capturedRevision: string;
  label?: string;
  release?: ReleaseEvidence;
};
export type ActivityModel = { role?: string; profile?: string; operations: string[] };
export type ComponentModel = {
  purpose: string;
  owns: string[];
  activities: Record<string, ActivityModel>;
};
export type Goal = {
  id: string;
  title: string;
  priority: number;
  plan: Plan[];
  snapshots: RunRevision[];
  positions: { seq: number; completed: number; activities: Record<string, number> }[];
  review: Review[];
  logs: RunEvent[];
  activations: Activation[];
  receipts: {
    seq: number;
    owner: string;
    activity: string;
    milestone: string | null;
    path: string;
    base?: string;
    head?: string;
    excerpt?: string;
    truncated?: boolean;
  }[];
  components: Record<string, ComponentModel>;
  delivery: {
    pr?: string;
    prCommits?: number;
    issue?: string;
    issueState?: 'open' | 'closed';
    issueComments?: number;
    commit?: string;
    files: [string, string][];
    patch?: string;
    patchPath?: string;
    patchExcerpt?: boolean;
    publication: { candidate: string; parent: string; branch: string; head?: string } | null;
  };
  hostedFailures: { seq: number; pr?: string; diagnostic: string }[];
  checkpoints?: ReleaseCheckpoint[];
  outcome: { kind: string; summary: string; at: string };
};
export type Clarification = {
  question: string;
  sequence: number;
  time: string;
  answer: string;
  answerSequence: number;
  answerTime: string;
};
export type WorkspaceQuestion = {
  area: Area;
  id: string;
  prompt: string;
  supporting: string;
  recommendation?: string;
  choices?: [string, string][];
  answer?: string;
};
export type Phase = {
  stats: Stats;
  detail: string;
  wall: string;
  rows: EventRow[];
  modified: string[];
  clarification?: Clarification;
  issue?: string;
  issueState?: 'open' | 'closed';
  issueComments?: number;
  pr?: string;
  prState?: 'open' | 'closed' | 'merged';
  prCommits?: number;
};
export type Capture = {
  fileReview?: boolean;
  plan: Phase;
  architect: Phase;
  files: DesignFile[];
  goals: Goal[];
  tools: Record<string, ToolCall>;
  payloads: unknown[];
  directories: string[];
  artifactRoot: string;
  toolUsage: { host: number; provider: number; names: Record<string, number>; messages: number };
  round: {
    started: string;
    ended: string;
    wall: string;
    native: string;
    following: string;
    coverage: { activations: number; withReportedUsage: number };
    usage: { input_tokens: number; output_tokens: number; cached_input_tokens: number };
  };
};
export type Actor = { key: string; role: string };
export type PreviewCommand = { operation: string; instruction: string; actors: Actor[] };

const fallback = await loadCapture();
export const data = fallback;
export const files = data.fileReview ? data.files : [...data.files, ogsmGoalFile];
const defaultGoal = data.goals.at(-1);

export const state = {
  route: data.fileReview ? '/' + requireValue(files[0]).area + '/file/' : '/plan/',
  goal: defaultGoal?.id ?? '',
  component: 'execution',
  milestone: '',
  activity: 'implementation',
  fileId: 0,
  revision: 0,
  expandedPane: null as string | null,
  questionId: '',
  runRevision: String(defaultGoal?.snapshots[0]?.seq ?? ''),
  editing: false,
  saved: false,
  filters: {
    plan: { type: 'Goal', sort: 'priority', query: '', topics: [], changed: false },
    architect: { type: 'Component', sort: 'priority', query: '', topics: [], changed: false },
  } satisfies Record<Area, Filter> as Record<Area, Filter>,
};
export const inspector = { tool: null as ToolCall | null };
export const displayedRows = new Map<string, EventRow>();
export const operationGroups = new Map<string, EventRow[]>();
export const expandedGroups = new Set<string>();
export const composerState = {
  active: null as (PreviewCommand & { actorIndex: number; prompted: boolean }) | null,
  queue: [] as PreviewCommand[],
  questions: new Map<string, WorkspaceQuestion>(),
  drafts: new Map<string, string>(),
  waiting: '',
  conversations: new Map<string, EventRow[]>(),
  sequence: 0,
  feedback: '',
};

export function requireValue<T>(value: T | undefined | null): T {
  if (value == null) throw new Error('Required mockup data or layout element is missing');
  return value;
}

export function dom<T extends Element = HTMLElement>(selector: string): T {
  return requireValue(document.querySelector<T>(selector));
}

export const root = dom('#arc-preview');
export const main = dom('.arc-main');
export const launch = dom<HTMLFormElement>('.arc-launch');

async function loadCapture(): Promise<Capture> {
  const captureNode = dom('#arc-capture');
  const source = captureNode.textContent ?? '';
  const bytes = captureNode.dataset.encoding === 'base85'
    ? decodeBase85(source) : Uint8Array.from(atob(source), (byte) => byte.charCodeAt(0));
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  const capture = (await new Response(stream).json()) as Capture;
  for (const item of capture.files) {
    const [current, previous] = item.revisions;
    if (current && previous?.restore) {
      const lines = current.content.split('\n');
      for (const [start, end, replacement] of [...previous.restore].reverse()) {
        lines.splice(start, end - start, ...replacement);
      }
      previous.content = lines.join('\n');
    }
    previewTopics(item);
  }
  return capture;
}

export function fileArea(): Area {
  return state.route.startsWith('/architect/') ? 'architect' : 'plan';
}
