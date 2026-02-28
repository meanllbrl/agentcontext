import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { distillTranscript, formatDistilled } from '../../src/cli/commands/transcript.js';

function makeTmpDir(): string {
  const dir = join(tmpdir(), `ac-distill-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function makeEntry(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    type: 'assistant',
    message: { role: 'assistant', content: [] },
    ...overrides,
  });
}

function userMessage(text: string): string {
  return JSON.stringify({
    type: 'human',
    message: { role: 'user', content: text },
  });
}

function assistantText(text: string): string {
  return JSON.stringify({
    type: 'assistant',
    message: {
      role: 'assistant',
      content: [{ type: 'text', text }],
    },
  });
}

function toolCall(name: string, input: Record<string, unknown> = {}): string {
  return JSON.stringify({
    type: 'assistant',
    message: {
      role: 'assistant',
      content: [{ type: 'tool_use', name, input }],
    },
  });
}

describe('distillTranscript', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns empty sections for non-existent file', () => {
    const result = distillTranscript('/tmp/nonexistent-file.jsonl');
    expect(result.userMessages).toEqual([]);
    expect(result.agentDecisions).toEqual([]);
    expect(result.codeChanges).toEqual([]);
    expect(result.errors).toEqual([]);
    expect(result.bookmarks).toEqual([]);
  });

  it('returns empty sections for empty file', () => {
    const file = join(tmpDir, 'empty.jsonl');
    writeFileSync(file, '');
    const result = distillTranscript(file);
    expect(result.userMessages).toEqual([]);
  });

  it('extracts user messages', () => {
    const file = join(tmpDir, 'test.jsonl');
    writeFileSync(file, [
      userMessage('Add rate limiting to auth endpoints'),
      userMessage('Use the existing middleware pattern'),
    ].join('\n'));

    const result = distillTranscript(file);
    expect(result.userMessages).toHaveLength(2);
    expect(result.userMessages[0]).toContain('rate limiting');
    expect(result.userMessages[1]).toContain('middleware pattern');
  });

  it('extracts user messages from array content (multi-block)', () => {
    const file = join(tmpDir, 'test.jsonl');
    writeFileSync(file, [
      JSON.stringify({
        type: 'user',
        message: {
          role: 'user',
          content: [
            { type: 'text', text: 'First block of text' },
            { type: 'text', text: 'Second block of text' },
          ],
        },
      }),
      JSON.stringify({
        type: 'user',
        message: {
          role: 'user',
          content: [
            { type: 'text', text: 'Tool result: success' },
            { type: 'tool_result', content: [
              { type: 'text', text: 'Result details here' },
            ]},
          ],
        },
      }),
    ].join('\n'));

    const result = distillTranscript(file);
    expect(result.userMessages.length).toBeGreaterThanOrEqual(2);
    expect(result.userMessages[0]).toContain('First block');
    expect(result.userMessages[0]).toContain('Second block');
    expect(result.userMessages[1]).toContain('success');
    expect(result.userMessages[1]).toContain('Result details');
  });

  it('extracts agent text responses', () => {
    const file = join(tmpDir, 'test.jsonl');
    writeFileSync(file, [
      assistantText('I chose token bucket algorithm over sliding window for rate limiting because it handles burst traffic better.'),
    ].join('\n'));

    const result = distillTranscript(file);
    expect(result.agentDecisions).toHaveLength(1);
    expect(result.agentDecisions[0]).toContain('token bucket');
  });

  it('skips trivial agent responses', () => {
    const file = join(tmpDir, 'test.jsonl');
    writeFileSync(file, [
      assistantText('Done!'),
      assistantText('OK'),
    ].join('\n'));

    const result = distillTranscript(file);
    expect(result.agentDecisions).toEqual([]);
  });

  it('extracts Write and Edit tool calls as code changes with size info', () => {
    const file = join(tmpDir, 'test.jsonl');
    writeFileSync(file, [
      toolCall('Write', { file_path: '/src/middleware/rate-limit.ts', content: 'const limit = 100;\nconst window = 60000;' }),
      toolCall('Edit', { file_path: '/src/routes/auth.ts', old_string: 'old code', new_string: 'new code is here' }),
    ].join('\n'));

    const result = distillTranscript(file);
    expect(result.codeChanges).toHaveLength(2);
    expect(result.codeChanges[0]).toContain('WRITE /src/middleware/rate-limit.ts');
    expect(result.codeChanges[0]).toContain('lines'); // Shows line count
    expect(result.codeChanges[1]).toContain('EDIT /src/routes/auth.ts');
    expect(result.codeChanges[1]).toMatch(/\[\+\d+B\]/); // Shows +N bytes delta
  });

  it('discards Read, Glob, Grep tool calls (noise)', () => {
    const file = join(tmpDir, 'test.jsonl');
    writeFileSync(file, [
      toolCall('Read', { file_path: '/src/config.ts' }),
      toolCall('Glob', { pattern: '**/*.ts' }),
      toolCall('Grep', { pattern: 'rate.*limit' }),
    ].join('\n'));

    const result = distillTranscript(file);
    expect(result.codeChanges).toEqual([]);
    expect(result.agentDecisions).toEqual([]);
  });

  it('extracts modifying Bash commands', () => {
    const file = join(tmpDir, 'test.jsonl');
    writeFileSync(file, [
      toolCall('Bash', { command: 'npm install express-rate-limit@7' }),
      toolCall('Bash', { command: 'git commit -m "add rate limiting"' }),
    ].join('\n'));

    const result = distillTranscript(file);
    expect(result.codeChanges).toHaveLength(2);
    expect(result.codeChanges[0]).toContain('npm install');
    expect(result.codeChanges[1]).toContain('git commit');
  });

  it('extracts bookmark bash commands', () => {
    const file = join(tmpDir, 'test.jsonl');
    writeFileSync(file, [
      toolCall('Bash', { command: 'agentcontext bookmark add "Critical: always validate auth tokens" -s 3' }),
    ].join('\n'));

    const result = distillTranscript(file);
    expect(result.bookmarks).toHaveLength(1);
    expect(result.bookmarks[0]).toContain('agentcontext bookmark');
  });

  it('caps long user messages at 500 chars', () => {
    const file = join(tmpDir, 'test.jsonl');
    const longMsg = 'A'.repeat(600);
    writeFileSync(file, userMessage(longMsg));

    const result = distillTranscript(file);
    expect(result.userMessages[0].length).toBeLessThanOrEqual(500);
    expect(result.userMessages[0]).toContain('...');
  });

  it('handles malformed JSONL lines gracefully', () => {
    const file = join(tmpDir, 'test.jsonl');
    writeFileSync(file, [
      'not valid json',
      userMessage('Valid message'),
      '{incomplete',
    ].join('\n'));

    const result = distillTranscript(file);
    expect(result.userMessages).toHaveLength(1);
    expect(result.userMessages[0]).toContain('Valid message');
  });
});

describe('formatDistilled', () => {
  it('formats distilled transcript as markdown', () => {
    const output = formatDistilled('sess-123', {
      userMessages: ['Add rate limiting'],
      agentDecisions: ['Chose token bucket algorithm'],
      codeChanges: ['WRITE /src/rate-limit.ts'],
      errors: ['express-rate-limit v7 API changed'],
      bookmarks: ['agentcontext bookmark "critical constraint"'],
    });

    expect(output).toContain('## Session sess-123');
    expect(output).toContain('### User Messages');
    expect(output).toContain('Add rate limiting');
    expect(output).toContain('### Agent Decisions');
    expect(output).toContain('token bucket');
    expect(output).toContain('### Code Changes');
    expect(output).toContain('WRITE /src/rate-limit.ts');
    expect(output).toContain('### Errors');
    expect(output).toContain('### Bookmarks');
  });

  it('omits empty sections', () => {
    const output = formatDistilled('sess-456', {
      userMessages: ['Hello'],
      agentDecisions: [],
      codeChanges: [],
      errors: [],
      bookmarks: [],
    });

    expect(output).toContain('### User Messages');
    expect(output).not.toContain('### Agent Decisions');
    expect(output).not.toContain('### Code Changes');
    expect(output).not.toContain('### Errors');
    expect(output).not.toContain('### Bookmarks');
  });
});
