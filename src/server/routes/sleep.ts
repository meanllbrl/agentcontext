import { IncomingMessage, ServerResponse } from 'node:http';
import { readSleepState, writeSleepState } from '../../cli/commands/sleep.js';
import { parseJsonBody, sendJson, sendError } from '../middleware.js';
import { recordDashboardChange, buildFieldSummary } from '../change-tracker.js';
import type { FieldChange } from '../change-tracker.js';

/**
 * GET /api/sleep - Get sleep state
 */
export async function handleSleepGet(
  _req: IncomingMessage,
  res: ServerResponse,
  _params: Record<string, string>,
  contextRoot: string,
): Promise<void> {
  const state = readSleepState(contextRoot);
  sendJson(res, 200, state);
}

/**
 * PATCH /api/sleep - Update sleep state (manual debt add, etc.)
 */
export async function handleSleepUpdate(
  req: IncomingMessage,
  res: ServerResponse,
  _params: Record<string, string>,
  contextRoot: string,
): Promise<void> {
  const body = await parseJsonBody(req);
  if (!body) {
    sendError(res, 400, 'invalid_body', 'Request body must be JSON.');
    return;
  }

  const state = readSleepState(contextRoot);
  const oldDebt = state.debt;
  const fieldChanges: FieldChange[] = [];

  if (typeof body.debt === 'number' && body.debt !== oldDebt) {
    state.debt = body.debt;
    fieldChanges.push({ field: 'debt', from: oldDebt, to: body.debt });
  }

  writeSleepState(contextRoot, state);

  if (fieldChanges.length > 0) {
    recordDashboardChange(contextRoot, {
      entity: 'sleep',
      action: 'update',
      target: 'state/.sleep.json',
      field: fieldChanges.map(f => f.field).join(', '),
      fields: fieldChanges,
      summary: buildFieldSummary('sleep', 'state/.sleep.json', fieldChanges),
    });
  }

  const updatedState = readSleepState(contextRoot);
  sendJson(res, 200, updatedState);
}
