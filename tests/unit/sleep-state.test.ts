import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { readSleepState, SleepState } from '../../src/cli/commands/sleep.js';

function makeTmpDir(): string {
  const dir = join(tmpdir(), `ac-sleep-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe('readSleepState', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    mkdirSync(join(tmpDir, 'state'), { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns default state when file does not exist', () => {
    const state = readSleepState(tmpDir);
    expect(state).toEqual({
      debt: 0,
      last_sleep: null,
      last_sleep_summary: null,
      sessions: [],
    });
  });

  it('reads persisted sleep state with sessions', () => {
    const expected: SleepState = {
      debt: 5,
      last_sleep: '2026-02-24',
      last_sleep_summary: 'Consolidated auth decisions',
      sessions: [
        {
          session_id: 'sess-2',
          transcript_path: '/tmp/t2.jsonl',
          stopped_at: '2026-02-25T12:00:00.000Z',
          last_assistant_message: 'Refactored auth module',
          change_count: 8,
          score: 2,
        },
        {
          session_id: 'sess-1',
          transcript_path: '/tmp/t1.jsonl',
          stopped_at: '2026-02-25T10:00:00.000Z',
          last_assistant_message: 'Added search endpoint',
          change_count: 5,
          score: 3,
        },
      ],
    };
    writeFileSync(join(tmpDir, 'state', '.sleep.json'), JSON.stringify(expected, null, 2));
    const state = readSleepState(tmpDir);
    expect(state).toEqual(expected);
  });

  it('returns default state when file is malformed JSON', () => {
    writeFileSync(join(tmpDir, 'state', '.sleep.json'), 'not json at all');
    const state = readSleepState(tmpDir);
    expect(state).toEqual({
      debt: 0,
      last_sleep: null,
      last_sleep_summary: null,
      sessions: [],
    });
  });

  it('returns default state when file is a JSON array', () => {
    writeFileSync(join(tmpDir, 'state', '.sleep.json'), '[1, 2, 3]');
    const state = readSleepState(tmpDir);
    expect(state).toEqual({
      debt: 0,
      last_sleep: null,
      last_sleep_summary: null,
      sessions: [],
    });
  });

  it('reads state with empty sessions', () => {
    const minimal: SleepState = {
      debt: 0,
      last_sleep: null,
      last_sleep_summary: null,
      sessions: [],
    };
    writeFileSync(join(tmpDir, 'state', '.sleep.json'), JSON.stringify(minimal, null, 2));
    const state = readSleepState(tmpDir);
    expect(state).toEqual(minimal);
  });

  it('reads state after consolidation (debt 0 with last_sleep set)', () => {
    const postSleep: SleepState = {
      debt: 0,
      last_sleep: '2026-02-25',
      last_sleep_summary: 'Consolidated everything',
      sessions: [],
    };
    writeFileSync(join(tmpDir, 'state', '.sleep.json'), JSON.stringify(postSleep, null, 2));
    const state = readSleepState(tmpDir);
    expect(state.debt).toBe(0);
    expect(state.last_sleep).toBe('2026-02-25');
    expect(state.last_sleep_summary).toBe('Consolidated everything');
    expect(state.sessions).toEqual([]);
  });

  it('backward compat: old format with entries/last_session_id gets sessions: []', () => {
    const oldFormat = {
      debt: 3,
      last_sleep: '2026-01-01',
      last_sleep_summary: 'old',
      entries: [{ date: '2026-02-25', score: 1, description: 'test' }],
      last_session_id: 'old-sess',
      last_transcript_path: '/tmp/old.jsonl',
    };
    writeFileSync(join(tmpDir, 'state', '.sleep.json'), JSON.stringify(oldFormat, null, 2));
    const state = readSleepState(tmpDir);
    expect(state.debt).toBe(3);
    expect(state.sessions).toEqual([]);
    expect(state.last_sleep).toBe('2026-01-01');
  });

  it('handles sessions field set to null gracefully', () => {
    const corrupted = {
      debt: 2,
      last_sleep: null,
      last_sleep_summary: null,
      sessions: null,
    };
    writeFileSync(join(tmpDir, 'state', '.sleep.json'), JSON.stringify(corrupted, null, 2));
    const state = readSleepState(tmpDir);
    expect(state.sessions).toEqual([]);
  });
});
