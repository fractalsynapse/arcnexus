import { readFileSync } from 'node:fs';
import {
  workflowAnswer,
  workflowReceipt,
  workflowSelection,
  workflowSubmission,
} from '../../../packages/commands/src/index.js';
import { platformRequest } from './platform-inspect.js';

function command(verb: string, args: string[]) {
  const [receipt, gate] = args;
  if (verb === 'submit' && args.length === 1 && receipt) {
    const body = workflowSubmission.parse(JSON.parse(readFileSync(receipt, 'utf8')) as unknown);
    return { path: '', method: 'POST', body };
  }
  if (args.length === 1 && (verb === 'receipt' || verb === 'cancel')) {
    const { id } = workflowSelection.parse({ id: receipt });
    return {
      path: '/' + id + (verb === 'cancel' ? '/cancel' : ''),
      method: verb === 'cancel' ? 'POST' : 'GET',
    };
  }
  if (verb === 'answer' && args.length === 2) {
    const { id, ...body } = workflowAnswer.parse({
      id: receipt,
      gate,
      answer: readFileSync(0, 'utf8'),
    });
    return { path: '/' + id + '/answer', method: 'POST', body };
  }
  throw new Error(
    'Use platform submit <request.json>, receipt <id>, cancel <id>, or answer <id> <gate> (answer via stdin)',
  );
}

/** Submit or inspect a durable hosted command using the same gateway as the web app. */
export async function runPlatformWorkflow(verb: string, args: string[], json: boolean) {
  const { path, body, method } = command(verb, args);
  const response = await platformRequest('/commands' + path, {
    method,
    ...(body && {
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  });
  if (!response.ok)
    throw new Error('Platform workflow request unavailable (' + response.status + ')');
  const receipt = workflowReceipt.parse(await response.json());
  if (json) console.log(JSON.stringify(receipt, null, 2));
  else {
    console.log(receipt.id + ' · ' + receipt.state);
    if (receipt.execution) console.log('Execution ' + receipt.execution);
    if (receipt.state === 'waiting' && receipt.gate)
      console.log(receipt.gate.question + '\nGate ' + receipt.gate.id);
    if (receipt.outcome) console.log(JSON.stringify(receipt.outcome, null, 2));
  }
}
