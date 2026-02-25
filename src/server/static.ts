import { IncomingMessage, ServerResponse } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

/**
 * Serve static files from a directory. Falls back to index.html for SPA routing.
 */
export function serveStatic(
  req: IncomingMessage,
  res: ServerResponse,
  staticDir: string,
): void {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);
  let filePath = join(staticDir, url.pathname);

  // Prevent directory traversal
  if (!filePath.startsWith(staticDir)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  // If path is a directory, try index.html
  if (existsSync(filePath) && statSync(filePath).isDirectory()) {
    filePath = join(filePath, 'index.html');
  }

  // Serve the file if it exists
  if (existsSync(filePath) && statSync(filePath).isFile()) {
    const ext = extname(filePath);
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const content = readFileSync(filePath);
    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': content.length,
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
    });
    res.end(content);
    return;
  }

  // SPA fallback: serve index.html for non-file requests
  const indexPath = join(staticDir, 'index.html');
  if (existsSync(indexPath)) {
    const content = readFileSync(indexPath);
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Length': content.length,
      'Cache-Control': 'no-cache',
    });
    res.end(content);
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
}
