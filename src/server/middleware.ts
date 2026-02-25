import { IncomingMessage, ServerResponse } from 'node:http';

const MAX_BODY_SIZE = 1_048_576; // 1MB

/**
 * Parse JSON body from request. Returns parsed object or null.
 */
export async function parseJsonBody(req: IncomingMessage): Promise<Record<string, unknown> | null> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_SIZE) {
        req.destroy();
        resolve(null);
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (chunks.length === 0) {
        resolve(null);
        return;
      }
      try {
        const body = Buffer.concat(chunks).toString('utf-8');
        resolve(JSON.parse(body));
      } catch {
        resolve(null);
      }
    });
    req.on('error', () => resolve(null));
  });
}

/**
 * Send JSON response.
 */
export function sendJson(res: ServerResponse, statusCode: number, data: unknown): void {
  const body = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
    'Access-Control-Allow-Origin': '*',
  });
  res.end(body);
}

/**
 * Send error response.
 */
export function sendError(res: ServerResponse, statusCode: number, error: string, message: string): void {
  sendJson(res, statusCode, { error, message });
}

/**
 * Handle CORS preflight.
 */
export function handleCors(req: IncomingMessage, res: ServerResponse): boolean {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return true;
  }
  return false;
}
