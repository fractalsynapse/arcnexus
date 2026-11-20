import assert from 'node:assert/strict';
import test from 'node:test';
import { parse } from 'yaml';
import { Architecture, type Capture } from '../../src/index.js';

const actingPurpose = 'Acting purpose with complete detail. '.repeat(200);
const instructions = ['Selected instructions with complete detail. '.repeat(200)];
const foreignPurpose = 'Foreign purpose that must remain outside the index. '.repeat(200);
const foreignInstruction = 'Foreign activity instructions must remain outside the index.';
const activity = {
  role: 'designer',
  profile: 'standard',
  instructions,
  operations: ['read'],
  standards: [],
};

const capture: Capture = {
  source: {
    root: '/generic',
    revision: 'generic-revision',
    remote: 'https://example.com/generic.git',
    paths: [],
    read: (path: string) => {
      throw new Error(`Unexpected source read: ${path}`);
    },
  },
  project: {
    id: 'generic',
    remote: 'https://example.com/generic.git',
    contractRegistry: 'contracts.yaml',
    planTemplate: 'plan.md',
    director: { component: 'other', activity: 'direct' },
    verifier: { component: 'plain', activity: 'review' },
  },
  components: {
    acting: {
      id: 'acting',
      purpose: actingPurpose,
      owns: ['acting'],
      activities: { work: activity },
    },
    other: {
      id: 'other',
      purpose: foreignPurpose,
      ...{ summary: 'A deliberately authored summary.' },
      owns: ['other'],
      activities: { direct: { ...activity, instructions: [foreignInstruction] } },
    },
    plain: {
      id: 'plain',
      purpose: 'Another private purpose.',
      owns: ['plain'],
      activities: { review: activity },
    },
  },
  roles: {
    designer: { id: 'designer', purpose: 'Design', responsibilities: [], instructions: [] },
  },
  profiles: {
    standard: {
      id: 'standard',
      model: 'model',
      reasoning: 'high',
      webSearch: 'disabled',
      operationCategories: ['read'],
    },
  },
  operations: { read: { id: 'read', category: 'read' } },
  standards: {},
  contracts: [],
};

/** Decode one attributed YAML section without relying on line wrapping. */
function decodedSection(input: string, name: string) {
  const section = input.split(`## ${name}\n`)[1]?.split('\n\n## ')[0];
  assert.ok(section, `Missing section: ${name}`);
  const [source, ...body] = section.split('\n\n');
  return { source, value: parse(body.join('\n\n')) as unknown };
}

test('request preserves complete selected content with source and task placeholders', () => {
  const result = new Architecture().request(capture, { component: 'acting', activity: 'work' });
  const activitySection = decodedSection(result.request.input, 'Activity');
  assert.equal(
    activitySection.source,
    'Source: .arc/architecture/components/acting.yaml (activities.work)',
  );
  assert.deepEqual(activitySection.value, {
    component: 'acting',
    purpose: actingPurpose,
    activity: 'work',
    instructions,
  });
  assert.deepEqual(result.placeholders, [
    '<assignment>',
    '<goal>',
    '<milestone>',
    '<acceptance>',
    '<evidence>',
    '<worktree>',
  ]);
  assert.match(result.request.input, /Goal: <goal>/);
  assert.match(result.request.input, /assignment: <assignment>/);
});

test('component index exposes authored summaries and sources without foreign definitions', () => {
  const result = new Architecture().request(capture, { component: 'acting', activity: 'work' });
  const index = decodedSection(result.request.input, 'Component index');
  assert.equal(index.source, 'Source: .arc/architecture/components/');
  assert.deepEqual(index.value, {
    other: {
      source: '.arc/architecture/components/other.yaml',
      summary: 'A deliberately authored summary.',
    },
    plain: { source: '.arc/architecture/components/plain.yaml' },
  });
  const decoded = JSON.stringify(index.value);
  assert.ok(!decoded.includes(foreignPurpose));
  assert.ok(!decoded.includes(foreignInstruction));
  assert.ok(!decoded.includes('Another private purpose.'));
});
