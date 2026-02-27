import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { readSleepState, writeSleepState, SleepHistoryEntry } from '../../src/cli/commands/sleep.js';

function makeTmpDir(): string {
  const dir = join(tmpdir(), `ac-hist-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe('Sleep History', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    mkdirSync(join(tmpDir, 'state'), { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('starts with empty history', () => {
    const state = readSleepState(tmpDir);
    expect(state.sleep_history).toEqual([]);
  });

  it('persists history entries', () => {
    const state = readSleepState(tmpDir);
    const entry: SleepHistoryEntry = {
      date: '2026-02-27',
      summary: 'Consolidated auth decisions',
      debt_before: 8,
      debt_after: 0,
      sessions_processed: 3,
      bookmarks_processed: 5,
    };
    state.sleep_history.unshift(entry);
    writeSleepState(tmpDir, state);

    const reread = readSleepState(tmpDir);
    expect(reread.sleep_history).toHaveLength(1);
    expect(reread.sleep_history[0].summary).toBe('Consolidated auth decisions');
    expect(reread.sleep_history[0].debt_before).toBe(8);
    expect(reread.sleep_history[0].debt_after).toBe(0);
    expect(reread.sleep_history[0].sessions_processed).toBe(3);
    expect(reread.sleep_history[0].bookmarks_processed).toBe(5);
  });

  it('maintains LIFO order', () => {
    const state = readSleepState(tmpDir);
    state.sleep_history.unshift({
      date: '2026-02-25',
      summary: 'First consolidation',
      debt_before: 5,
      debt_after: 0,
      sessions_processed: 2,
      bookmarks_processed: 1,
    });
    state.sleep_history.unshift({
      date: '2026-02-27',
      summary: 'Second consolidation',
      debt_before: 8,
      debt_after: 0,
      sessions_processed: 4,
      bookmarks_processed: 3,
    });
    writeSleepState(tmpDir, state);

    const reread = readSleepState(tmpDir);
    expect(reread.sleep_history[0].date).toBe('2026-02-27');
    expect(reread.sleep_history[1].date).toBe('2026-02-25');
  });
});
