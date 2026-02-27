import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { readSleepHistory, writeSleepHistory, SleepHistoryEntry } from '../../src/cli/commands/sleep.js';

function makeTmpDir(): string {
  const dir = join(tmpdir(), `ac-hist-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe('Sleep History (separate file)', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    mkdirSync(join(tmpDir, 'state'), { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('starts with empty history when file does not exist', () => {
    const history = readSleepHistory(tmpDir);
    expect(history).toEqual([]);
  });

  it('persists history entries', () => {
    const entry: SleepHistoryEntry = {
      date: '2026-02-27',
      summary: 'Consolidated auth decisions',
      debt_before: 8,
      debt_after: 0,
      sessions_processed: 3,
      bookmarks_processed: 5,
    };
    writeSleepHistory(tmpDir, [entry]);

    const history = readSleepHistory(tmpDir);
    expect(history).toHaveLength(1);
    expect(history[0].summary).toBe('Consolidated auth decisions');
    expect(history[0].debt_before).toBe(8);
    expect(history[0].debt_after).toBe(0);
    expect(history[0].sessions_processed).toBe(3);
    expect(history[0].bookmarks_processed).toBe(5);
  });

  it('maintains LIFO order', () => {
    const entries: SleepHistoryEntry[] = [
      {
        date: '2026-02-27',
        summary: 'Second consolidation',
        debt_before: 8,
        debt_after: 0,
        sessions_processed: 4,
        bookmarks_processed: 3,
      },
      {
        date: '2026-02-25',
        summary: 'First consolidation',
        debt_before: 5,
        debt_after: 0,
        sessions_processed: 2,
        bookmarks_processed: 1,
      },
    ];
    writeSleepHistory(tmpDir, entries);

    const history = readSleepHistory(tmpDir);
    expect(history[0].date).toBe('2026-02-27');
    expect(history[1].date).toBe('2026-02-25');
  });

  it('writes to a separate file from .sleep.json', () => {
    writeSleepHistory(tmpDir, [{
      date: '2026-02-27',
      summary: 'test',
      debt_before: 3,
      debt_after: 0,
      sessions_processed: 1,
      bookmarks_processed: 0,
    }]);

    expect(existsSync(join(tmpDir, 'state', '.sleep-history.json'))).toBe(true);
  });
});
