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
      consolidated_at: '2026-02-27T14:00:00.000Z',
      summary: 'Consolidated auth decisions',
      debt_before: 8,
      debt_after: 0,
      sessions_processed: 3,
      bookmarks_processed: 5,
      session_ids: ['sess-1', 'sess-2', 'sess-3'],
    };
    writeSleepHistory(tmpDir, [entry]);

    const history = readSleepHistory(tmpDir);
    expect(history).toHaveLength(1);
    expect(history[0].summary).toBe('Consolidated auth decisions');
    expect(history[0].debt_before).toBe(8);
    expect(history[0].debt_after).toBe(0);
    expect(history[0].sessions_processed).toBe(3);
    expect(history[0].bookmarks_processed).toBe(5);
    expect(history[0].consolidated_at).toBe('2026-02-27T14:00:00.000Z');
    expect(history[0].session_ids).toEqual(['sess-1', 'sess-2', 'sess-3']);
  });

  it('maintains LIFO order', () => {
    const entries: SleepHistoryEntry[] = [
      {
        date: '2026-02-27',
        consolidated_at: '2026-02-27T14:00:00.000Z',
        summary: 'Second consolidation',
        debt_before: 8,
        debt_after: 0,
        sessions_processed: 4,
        bookmarks_processed: 3,
        session_ids: ['sess-3', 'sess-4'],
      },
      {
        date: '2026-02-25',
        consolidated_at: '2026-02-25T10:00:00.000Z',
        summary: 'First consolidation',
        debt_before: 5,
        debt_after: 0,
        sessions_processed: 2,
        bookmarks_processed: 1,
        session_ids: ['sess-1', 'sess-2'],
      },
    ];
    writeSleepHistory(tmpDir, entries);

    const history = readSleepHistory(tmpDir);
    expect(history[0].date).toBe('2026-02-27');
    expect(history[1].date).toBe('2026-02-25');
  });

  it('reads old entries without session_ids or consolidated_at gracefully', () => {
    // Backward compat: old entries may not have the new fields
    const oldEntry = {
      date: '2026-02-20',
      summary: 'Old consolidation',
      debt_before: 5,
      debt_after: 0,
      sessions_processed: 2,
      bookmarks_processed: 0,
    };
    writeSleepHistory(tmpDir, [oldEntry as SleepHistoryEntry]);

    const history = readSleepHistory(tmpDir);
    expect(history).toHaveLength(1);
    expect(history[0].session_ids).toBeUndefined();
    expect(history[0].consolidated_at).toBeUndefined();
    expect(history[0].summary).toBe('Old consolidation');
  });

  it('writes to a separate file from .sleep.json', () => {
    writeSleepHistory(tmpDir, [{
      date: '2026-02-27',
      consolidated_at: '2026-02-27T14:00:00.000Z',
      summary: 'test',
      debt_before: 3,
      debt_after: 0,
      sessions_processed: 1,
      bookmarks_processed: 0,
      session_ids: ['sess-1'],
    }]);

    expect(existsSync(join(tmpDir, 'state', '.sleep-history.json'))).toBe(true);
  });
});
