import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { analyzeTranscript, scoreFromChangeCount, scoreFromToolCount } from '../../src/cli/commands/hook.js';

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

describe('scoreFromToolCount', () => {
  it('returns 0 for 0 tools', () => {
    expect(scoreFromToolCount(0)).toBe(0);
  });

  it('returns 0 for negative', () => {
    expect(scoreFromToolCount(-1)).toBe(0);
  });

  it('returns 1 for 1 tool call', () => {
    expect(scoreFromToolCount(1)).toBe(1);
  });

  it('returns 1 for 15 tool calls', () => {
    expect(scoreFromToolCount(15)).toBe(1);
  });

  it('returns 2 for 16 tool calls', () => {
    expect(scoreFromToolCount(16)).toBe(2);
  });

  it('returns 2 for 40 tool calls', () => {
    expect(scoreFromToolCount(40)).toBe(2);
  });

  it('returns 3 for 41 tool calls', () => {
    expect(scoreFromToolCount(41)).toBe(3);
  });

  it('returns 3 for 100 tool calls', () => {
    expect(scoreFromToolCount(100)).toBe(3);
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

  it('returns zeros for non-existent file', () => {
    const result = analyzeTranscript(join(tmpDir, 'nope.jsonl'));
    expect(result.changeCount).toBe(0);
    expect(result.toolCount).toBe(0);
  });

  it('returns zeros for empty file', () => {
    const f = join(tmpDir, 'empty.jsonl');
    writeFileSync(f, '');
    const result = analyzeTranscript(f);
    expect(result.changeCount).toBe(0);
    expect(result.toolCount).toBe(0);
  });

  it('counts Write tool uses', () => {
    const f = join(tmpDir, 'transcript.jsonl');
    writeFileSync(f, [toolUseLine('Write'), toolUseLine('Write')].join('\n'));
    const result = analyzeTranscript(f);
    expect(result.changeCount).toBe(2);
    expect(result.toolCount).toBe(2);
  });

  it('counts Edit tool uses', () => {
    const f = join(tmpDir, 'transcript.jsonl');
    writeFileSync(f, toolUseLine('Edit'));
    const result = analyzeTranscript(f);
    expect(result.changeCount).toBe(1);
    expect(result.toolCount).toBe(1);
  });

  it('counts Write/Edit for changeCount, all tools for toolCount', () => {
    const f = join(tmpDir, 'transcript.jsonl');
    const lines = [
      toolUseLine('Write'),
      toolUseLine('Edit'),
      toolUseLine('Read'),
      toolUseLine('Bash'),
      toolUseLine('Glob'),
    ];
    writeFileSync(f, lines.join('\n'));
    const result = analyzeTranscript(f);
    expect(result.changeCount).toBe(2);
    expect(result.toolCount).toBe(5);
  });

  it('handles "name": "Write" with space after colon', () => {
    const f = join(tmpDir, 'spaced.jsonl');
    const line = '{"type":"assistant","message":{"content":[{"type":"tool_use","name": "Write","input":{}}]}}';
    writeFileSync(f, line);
    const result = analyzeTranscript(f);
    expect(result.changeCount).toBe(1);
    expect(result.toolCount).toBe(1);
  });

  it('does not false-positive on user text mentioning Write', () => {
    const f = join(tmpDir, 'user.jsonl');
    const line = JSON.stringify({
      type: 'human',
      message: { content: [{ type: 'text', text: 'Please use the "name":"Write" tool' }] },
    });
    writeFileSync(f, line);
    const result = analyzeTranscript(f);
    expect(result.changeCount).toBe(0);
    expect(result.toolCount).toBe(0);
  });

  it('counts multiple tool uses on one line', () => {
    const f = join(tmpDir, 'multi.jsonl');
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
    const result = analyzeTranscript(f);
    expect(result.changeCount).toBe(2);
    expect(result.toolCount).toBe(2);
  });

  it('counts Bash and Read in toolCount but not changeCount', () => {
    const f = join(tmpDir, 'bash-only.jsonl');
    const lines = [
      toolUseLine('Bash'),
      toolUseLine('Read'),
      toolUseLine('Glob'),
      toolUseLine('Grep'),
      toolUseLine('Bash'),
    ];
    writeFileSync(f, lines.join('\n'));
    const result = analyzeTranscript(f);
    expect(result.changeCount).toBe(0);
    expect(result.toolCount).toBe(5);
  });
});
