import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { analyzeTranscript, scoreFromChangeCount } from '../../src/cli/commands/hook.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeTmpDir(): string {
  const dir = join(tmpdir(), `ac-hook-unit-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function toolUseLine(name: string): string {
  return JSON.stringify({
    type: 'assistant',
    message: { content: [{ type: 'tool_use', name, input: {} }] },
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('scoreFromChangeCount', () => {
  it('returns 0 for 0 changes', () => {
    expect(scoreFromChangeCount(0)).toBe(0);
  });

  it('returns 0 for negative', () => {
    expect(scoreFromChangeCount(-1)).toBe(0);
  });

  it('returns 1 for 1 change', () => {
    expect(scoreFromChangeCount(1)).toBe(1);
  });

  it('returns 1 for 3 changes', () => {
    expect(scoreFromChangeCount(3)).toBe(1);
  });

  it('returns 2 for 4 changes', () => {
    expect(scoreFromChangeCount(4)).toBe(2);
  });

  it('returns 2 for 8 changes', () => {
    expect(scoreFromChangeCount(8)).toBe(2);
  });

  it('returns 3 for 9 changes', () => {
    expect(scoreFromChangeCount(9)).toBe(3);
  });

  it('returns 3 for 50 changes', () => {
    expect(scoreFromChangeCount(50)).toBe(3);
  });
});

describe('analyzeTranscript', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns 0 for non-existent file', () => {
    expect(analyzeTranscript(join(tmpDir, 'nope.jsonl'))).toBe(0);
  });

  it('returns 0 for empty file', () => {
    const f = join(tmpDir, 'empty.jsonl');
    writeFileSync(f, '');
    expect(analyzeTranscript(f)).toBe(0);
  });

  it('counts Write tool uses', () => {
    const f = join(tmpDir, 'transcript.jsonl');
    writeFileSync(f, [toolUseLine('Write'), toolUseLine('Write')].join('\n'));
    expect(analyzeTranscript(f)).toBe(2);
  });

  it('counts Edit tool uses', () => {
    const f = join(tmpDir, 'transcript.jsonl');
    writeFileSync(f, toolUseLine('Edit'));
    expect(analyzeTranscript(f)).toBe(1);
  });

  it('counts mixed Write and Edit, ignores Read and Bash', () => {
    const f = join(tmpDir, 'transcript.jsonl');
    const lines = [
      toolUseLine('Write'),
      toolUseLine('Edit'),
      toolUseLine('Read'),
      toolUseLine('Bash'),
      toolUseLine('Glob'),
    ];
    writeFileSync(f, lines.join('\n'));
    expect(analyzeTranscript(f)).toBe(2);
  });

  it('handles "name": "Write" with space after colon', () => {
    const f = join(tmpDir, 'spaced.jsonl');
    // Manually construct JSON with space after colon
    const line = '{"type":"assistant","message":{"content":[{"type":"tool_use","name": "Write","input":{}}]}}';
    writeFileSync(f, line);
    expect(analyzeTranscript(f)).toBe(1);
  });

  it('does not false-positive on user text mentioning Write', () => {
    const f = join(tmpDir, 'user.jsonl');
    // JSON.stringify escapes inner quotes, so "name":"Write" in user text
    // appears as \"name\":\"Write\" in the JSONL line
    const line = JSON.stringify({
      type: 'human',
      message: { content: [{ type: 'text', text: 'Please use the "name":"Write" tool' }] },
    });
    writeFileSync(f, line);
    expect(analyzeTranscript(f)).toBe(0);
  });

  it('counts multiple tool uses on one line', () => {
    const f = join(tmpDir, 'multi.jsonl');
    // An assistant message with two tool_use blocks in one content array
    const line = JSON.stringify({
      type: 'assistant',
      message: {
        content: [
          { type: 'tool_use', name: 'Write', input: {} },
          { type: 'tool_use', name: 'Edit', input: {} },
        ],
      },
    });
    writeFileSync(f, line);
    expect(analyzeTranscript(f)).toBe(2);
  });
});
