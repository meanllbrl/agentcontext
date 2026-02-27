import { describe, it, expect } from 'vitest';
import { scoreFromChangeCount, scoreFromToolCount } from '../../src/cli/commands/hook.js';

describe('scoreFromChangeCount', () => {
  it('returns 0 for 0 changes', () => expect(scoreFromChangeCount(0)).toBe(0));
  it('returns 1 for 1-3 changes', () => {
    expect(scoreFromChangeCount(1)).toBe(1);
    expect(scoreFromChangeCount(3)).toBe(1);
  });
  it('returns 2 for 4-8 changes', () => {
    expect(scoreFromChangeCount(4)).toBe(2);
    expect(scoreFromChangeCount(8)).toBe(2);
  });
  it('returns 3 for 9+ changes', () => {
    expect(scoreFromChangeCount(9)).toBe(3);
    expect(scoreFromChangeCount(100)).toBe(3);
  });
});

describe('scoreFromToolCount', () => {
  it('returns 0 for 0 tools', () => expect(scoreFromToolCount(0)).toBe(0));
  it('returns 1 for 1-15 tools', () => {
    expect(scoreFromToolCount(1)).toBe(1);
    expect(scoreFromToolCount(15)).toBe(1);
  });
  it('returns 2 for 16-40 tools', () => {
    expect(scoreFromToolCount(16)).toBe(2);
    expect(scoreFromToolCount(40)).toBe(2);
  });
  it('returns 3 for 41+ tools', () => {
    expect(scoreFromToolCount(41)).toBe(3);
    expect(scoreFromToolCount(200)).toBe(3);
  });
});
