import { IncomingMessage, ServerResponse } from 'node:http';
import { sendJson } from '../middleware.js';

export async function handleHealthGet(
  _req: IncomingMessage,
  res: ServerResponse,
  _params: Record<string, string>,
  contextRoot: string,
): Promise<void> {
  sendJson(res, 200, { ok: true, contextRoot });
}
