import { IncomingMessage, ServerResponse } from 'node:http';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { readJsonArray, insertToJsonArray } from '../../lib/json-file.js';
import { parseJsonBody, sendJson, sendError } from '../middleware.js';
import { generateId, today } from '../../lib/id.js';
import {
  getExistingReleases,
  findUnreleasedTasks,
  findUnreleasedFeatures,
  findUnreleasedChangelog,
} from '../../lib/release-discovery.js';
import type { ReleaseEntry } from '../../lib/release-discovery.js';
import { backPopulateFeatures } from '../../lib/release-backpopulate.js';
import { recordDashboardChange } from '../change-tracker.js';

/**
 * GET /api/changelog - Get changelog entries
 */
export async function handleChangelogGet(
  _req: IncomingMessage,
  res: ServerResponse,
  _params: Record<string, string>,
  contextRoot: string,
): Promise<void> {
  const filePath = join(contextRoot, 'core', 'CHANGELOG.json');
  if (!existsSync(filePath)) {
    sendJson(res, 200, { entries: [] });
    return;
  }

  try {
    const entries = readJsonArray(filePath);
    sendJson(res, 200, { entries });
  } catch {
    sendJson(res, 200, { entries: [] });
  }
}

/**
 * GET /api/releases - Get all release entries
 */
export async function handleReleasesGet(
  _req: IncomingMessage,
  res: ServerResponse,
  _params: Record<string, string>,
  contextRoot: string,
): Promise<void> {
  const filePath = join(contextRoot, 'core', 'RELEASES.json');
  if (!existsSync(filePath)) {
    sendJson(res, 200, { entries: [] });
    return;
  }

  try {
    const entries = readJsonArray(filePath);
    sendJson(res, 200, { entries });
  } catch {
    sendJson(res, 200, { entries: [] });
  }
}

/**
 * GET /api/releases/unreleased - Get auto-discovered unreleased items
 */
export async function handleUnreleasedGet(
  _req: IncomingMessage,
  res: ServerResponse,
  _params: Record<string, string>,
  contextRoot: string,
): Promise<void> {
  const tasks = findUnreleasedTasks(contextRoot);
  const features = findUnreleasedFeatures(contextRoot);
  const changelog = findUnreleasedChangelog(contextRoot);
  sendJson(res, 200, { tasks, features, changelog });
}

/**
 * GET /api/releases/:version - Get a single release
 */
export async function handleReleaseGet(
  _req: IncomingMessage,
  res: ServerResponse,
  params: Record<string, string>,
  contextRoot: string,
): Promise<void> {
  const entries = getExistingReleases(contextRoot);
  const release = entries.find(r => r.version === params.version);
  if (!release) {
    sendError(res, 404, 'not_found', `Release not found: ${params.version}`);
    return;
  }
  sendJson(res, 200, { release });
}

/**
 * POST /api/releases - Create a new release
 */
export async function handleReleasesCreate(
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

  const version = body.version as string;
  if (!version || typeof version !== 'string' || !version.trim()) {
    sendError(res, 400, 'missing_version', 'Version is required.');
    return;
  }

  // Check duplicate
  const existing = getExistingReleases(contextRoot);
  if (existing.some(r => r.version === version.trim())) {
    sendError(res, 409, 'already_exists', `Release ${version} already exists.`);
    return;
  }

  const release: ReleaseEntry = {
    id: generateId('rel'),
    version: version.trim(),
    date: today(),
    summary: ((body.summary as string) ?? '').trim(),
    breaking: body.breaking === true,
    features: Array.isArray(body.features) ? body.features : [],
    tasks: Array.isArray(body.tasks) ? body.tasks : [],
    changelog: Array.isArray(body.changelog) ? body.changelog : [],
  };

  const filePath = join(contextRoot, 'core', 'RELEASES.json');
  insertToJsonArray(filePath, release);

  // Back-populate features
  if (release.features.length > 0) {
    backPopulateFeatures(contextRoot, release.features, release.version);
  }

  recordDashboardChange(contextRoot, {
    entity: 'core',
    action: 'create',
    target: 'core/RELEASES.json',
    summary: `Created release ${release.version}`,
  });

  sendJson(res, 201, { release });
}
