import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  formatTable,
  formatList,
  formatStatus,
  formatPriority,
  header,
  highlight,
  miniBox,
  success,
  error,
  warn,
  info,
} from '../../src/lib/format.js';

describe('format', () => {
  describe('formatTable', () => {
    it('formats headers and rows into aligned table', () => {
      const result = formatTable(
        ['Name', 'Status'],
        [['auth', 'active'], ['db', 'done']],
      );
      expect(result).toContain('Name');
      expect(result).toContain('Status');
      expect(result).toContain('auth');
      expect(result).toContain('active');
      expect(result).toContain('db');
      expect(result).toContain('done');
    });

    it('returns "(no results)" for empty rows', () => {
      const result = formatTable(['Name'], []);
      expect(result).toContain('no results');
    });

    it('handles varying column widths', () => {
      const result = formatTable(
        ['ID', 'Description'],
        [['1', 'A very long description that exceeds the header']],
      );
      expect(result).toContain('A very long description');
    });

    it('handles single column', () => {
      const result = formatTable(['Name'], [['a'], ['b']]);
      expect(result).toContain('a');
      expect(result).toContain('b');
    });

    it('handles empty cell values', () => {
      const result = formatTable(
        ['A', 'B'],
        [['value', '']],
      );
      expect(result).toContain('value');
    });

    it('includes row numbers', () => {
      const result = formatTable(['Name'], [['test']]);
      expect(result).toContain('1.');
    });

    it('applies status coloring when statusCol is set', () => {
      const result = formatTable(
        ['Name', 'Status'],
        [['auth', 'active']],
        { statusCol: 1 },
      );
      // Should still contain the text (with ANSI codes)
      expect(result).toContain('auth');
      expect(result).toContain('active');
    });

    it('applies priority coloring when priorityCol is set', () => {
      const result = formatTable(
        ['Name', 'Priority'],
        [['task-1', 'high']],
        { priorityCol: 1 },
      );
      expect(result).toContain('task-1');
      expect(result).toContain('high');
    });
  });

  describe('formatList', () => {
    it('formats items with names', () => {
      const result = formatList([{ name: 'item1' }, { name: 'item2' }]);
      expect(result).toContain('item1');
      expect(result).toContain('item2');
    });

    it('includes descriptions when provided', () => {
      const result = formatList([{ name: 'auth', description: 'Authentication system' }]);
      expect(result).toContain('auth');
      expect(result).toContain('Authentication system');
    });

    it('returns "(no results)" for empty list', () => {
      const result = formatList([]);
      expect(result).toContain('no results');
    });

    it('handles items without description', () => {
      const result = formatList([{ name: 'solo' }]);
      expect(result).toContain('solo');
    });
  });

  describe('formatStatus', () => {
    it('returns colorized string for known statuses', () => {
      const result = formatStatus('active');
      expect(result).toContain('active');
    });

    it('handles unknown status gracefully', () => {
      const result = formatStatus('custom');
      expect(result).toContain('custom');
    });
  });

  describe('formatPriority', () => {
    it('returns colorized string for known priorities', () => {
      const result = formatPriority('critical');
      expect(result).toContain('critical');
    });

    it('handles unknown priority gracefully', () => {
      const result = formatPriority('urgent');
      expect(result).toContain('urgent');
    });
  });

  describe('header', () => {
    it('returns formatted header with diamond', () => {
      const result = header('Active Tasks');
      expect(result).toContain('Active Tasks');
      expect(result).toContain('◆');
      expect(result).toContain('─');
    });
  });

  describe('miniBox', () => {
    it('creates a bordered box', () => {
      const result = miniBox(['Hello', 'World']);
      expect(result).toContain('╭');
      expect(result).toContain('╰');
      expect(result).toContain('│');
      expect(result).toContain('Hello');
      expect(result).toContain('World');
    });

    it('handles single line', () => {
      const result = miniBox(['Single']);
      expect(result).toContain('Single');
      expect(result).toContain('╭');
      expect(result).toContain('╰');
    });
  });

  describe('highlight', () => {
    it('highlights matching terms (returns string)', () => {
      const result = highlight('Hello World', 'hello');
      expect(result).toContain('Hello');
    });

    it('handles empty query', () => {
      const result = highlight('Some text', '');
      expect(result).toBe('Some text');
    });

    it('is case-insensitive', () => {
      const result = highlight('TypeScript is great', 'typescript');
      expect(result).toContain('TypeScript');
    });

    it('handles special regex characters in query', () => {
      const result = highlight('file.test.ts', '.test.');
      expect(result).toContain('test');
    });

    it('highlights multiple terms', () => {
      const result = highlight('Alpha Beta Gamma', 'alpha gamma');
      expect(result).toContain('Alpha');
      expect(result).toContain('Gamma');
    });
  });

  describe('success/error/warn/info', () => {
    let logSpy: ReturnType<typeof vi.spyOn>;
    let errorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      logSpy.mockRestore();
      errorSpy.mockRestore();
    });

    it('success prints to console.log', () => {
      success('It worked');
      expect(logSpy).toHaveBeenCalledTimes(1);
      expect(logSpy.mock.calls[0][0]).toContain('It worked');
    });

    it('error prints to console.error', () => {
      error('It failed');
      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy.mock.calls[0][0]).toContain('It failed');
    });

    it('error prints hint when provided', () => {
      error('It failed', 'Try again');
      expect(errorSpy).toHaveBeenCalledTimes(2);
      expect(errorSpy.mock.calls[1][0]).toContain('Try again');
    });

    it('warn prints to console.log', () => {
      warn('Watch out');
      expect(logSpy).toHaveBeenCalledTimes(1);
      expect(logSpy.mock.calls[0][0]).toContain('Watch out');
    });

    it('info prints to console.log', () => {
      info('FYI');
      expect(logSpy).toHaveBeenCalledTimes(1);
      expect(logSpy.mock.calls[0][0]).toContain('FYI');
    });
  });
});
