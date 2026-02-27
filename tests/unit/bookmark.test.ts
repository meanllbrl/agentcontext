import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { readSleepState, writeSleepState, SleepState, Bookmark } from '../../src/cli/commands/sleep.js';

function makeTmpDir(): string {
  const dir = join(tmpdir(), `ac-bm-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function makeBookmark(overrides: Partial<Bookmark> = {}): Bookmark {
  return {
    id: `bm_test_${Date.now()}`,
    message: 'Test bookmark',
    salience: 2,
    created_at: new Date().toISOString(),
    session_id: null,
    ...overrides,
  };
}

describe('Bookmark operations via SleepState', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    mkdirSync(join(tmpDir, 'state'), { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('reads empty bookmarks from default state', () => {
    const state = readSleepState(tmpDir);
    expect(state.bookmarks).toEqual([]);
  });

  it('persists bookmarks through write/read cycle', () => {
    const state = readSleepState(tmpDir);
    state.bookmarks.unshift(makeBookmark({ message: 'Important decision' }));
    writeSleepState(tmpDir, state);

    const reread = readSleepState(tmpDir);
    expect(reread.bookmarks).toHaveLength(1);
    expect(reread.bookmarks[0].message).toBe('Important decision');
  });

  it('stores bookmarks in LIFO order', () => {
    const state = readSleepState(tmpDir);
    state.bookmarks.unshift(makeBookmark({ message: 'First' }));
    state.bookmarks.unshift(makeBookmark({ message: 'Second' }));
    writeSleepState(tmpDir, state);

    const reread = readSleepState(tmpDir);
    expect(reread.bookmarks[0].message).toBe('Second');
    expect(reread.bookmarks[1].message).toBe('First');
  });

  it('preserves salience levels 1, 2, 3', () => {
    const state = readSleepState(tmpDir);
    state.bookmarks.push(makeBookmark({ salience: 1, message: 'Notable' }));
    state.bookmarks.push(makeBookmark({ salience: 2, message: 'Significant' }));
    state.bookmarks.push(makeBookmark({ salience: 3, message: 'Critical' }));
    writeSleepState(tmpDir, state);

    const reread = readSleepState(tmpDir);
    expect(reread.bookmarks.map(b => b.salience)).toEqual([1, 2, 3]);
  });

  it('links bookmarks to session_id', () => {
    const state = readSleepState(tmpDir);
    const bm = makeBookmark({ session_id: null });
    state.bookmarks.push(bm);
    // Simulate stop hook linking
    state.bookmarks[0].session_id = 'sess-123';
    writeSleepState(tmpDir, state);

    const reread = readSleepState(tmpDir);
    expect(reread.bookmarks[0].session_id).toBe('sess-123');
  });

  it('epoch-based clearing removes pre-epoch bookmarks', () => {
    const epoch = '2026-02-27T10:00:00.000Z';
    const state = readSleepState(tmpDir);
    state.sleep_started_at = epoch;
    state.bookmarks.push(makeBookmark({ created_at: '2026-02-27T09:00:00.000Z', message: 'Before epoch' }));
    state.bookmarks.push(makeBookmark({ created_at: '2026-02-27T11:00:00.000Z', message: 'After epoch' }));

    // Simulate sleep done epoch-based clearing
    state.bookmarks = state.bookmarks.filter(b => b.created_at > epoch);

    expect(state.bookmarks).toHaveLength(1);
    expect(state.bookmarks[0].message).toBe('After epoch');
  });
});
