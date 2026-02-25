import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  readFrontmatter,
  writeFrontmatter,
  updateFrontmatterFields,
} from '../../src/lib/frontmatter.js';

function makeTmpDir(): string {
  const dir = join(tmpdir(), `ac-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe('frontmatter', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('readFrontmatter', () => {
    it('parses YAML frontmatter and body content', () => {
      const file = join(tmpDir, 'test.md');
      writeFileSync(file, '---\nname: test\ntype: soul\n---\n\n# Hello\n\nBody text.\n');
      const { data, content } = readFrontmatter(file);
      expect(data.name).toBe('test');
      expect(data.type).toBe('soul');
      expect(content).toContain('# Hello');
      expect(content).toContain('Body text.');
    });

    it('returns empty data for file without frontmatter', () => {
      const file = join(tmpDir, 'nofm.md');
      writeFileSync(file, '# Just markdown\n\nNo frontmatter here.\n');
      const { data, content } = readFrontmatter(file);
      expect(Object.keys(data)).toHaveLength(0);
      expect(content).toContain('# Just markdown');
    });

    it('handles complex frontmatter values', () => {
      const file = join(tmpDir, 'complex.md');
      writeFileSync(file, '---\ntags:\n  - ai\n  - agent\ncount: 42\nnested:\n  key: value\n---\n\nContent.\n');
      const { data } = readFrontmatter(file);
      expect(data.tags).toEqual(['ai', 'agent']);
      expect(data.count).toBe(42);
      expect((data.nested as Record<string, string>).key).toBe('value');
    });

    it('throws for non-existent file', () => {
      expect(() => readFrontmatter(join(tmpDir, 'nope.md'))).toThrow();
    });

    it('handles empty file', () => {
      const file = join(tmpDir, 'empty.md');
      writeFileSync(file, '');
      const { data, content } = readFrontmatter(file);
      expect(Object.keys(data)).toHaveLength(0);
      expect(content.trim()).toBe('');
    });

    it('handles frontmatter-only file (no body)', () => {
      const file = join(tmpDir, 'fm-only.md');
      writeFileSync(file, '---\nname: test\n---\n');
      const { data, content } = readFrontmatter(file);
      expect(data.name).toBe('test');
      expect(content.trim()).toBe('');
    });

    it('preserves date strings without coercion', () => {
      const file = join(tmpDir, 'date.md');
      writeFileSync(file, '---\nupdated: "2026-02-24"\n---\n\nContent.\n');
      const { data } = readFrontmatter(file);
      expect(data.updated).toBe('2026-02-24');
    });
  });

  describe('writeFrontmatter', () => {
    it('writes file with frontmatter and content', () => {
      const file = join(tmpDir, 'write.md');
      writeFrontmatter(file, { name: 'test', type: 'soul' }, '\n# Hello\n');
      const raw = readFileSync(file, 'utf-8');
      expect(raw).toContain('name: test');
      expect(raw).toContain('type: soul');
      expect(raw).toContain('# Hello');
    });

    it('overwrites existing file', () => {
      const file = join(tmpDir, 'overwrite.md');
      writeFileSync(file, 'OLD CONTENT');
      writeFrontmatter(file, { name: 'new' }, '\nNew body.\n');
      const raw = readFileSync(file, 'utf-8');
      expect(raw).not.toContain('OLD CONTENT');
      expect(raw).toContain('name: new');
      expect(raw).toContain('New body.');
    });

    it('handles empty content', () => {
      const file = join(tmpDir, 'empty-body.md');
      writeFrontmatter(file, { name: 'test' }, '');
      const { data, content } = readFrontmatter(file);
      expect(data.name).toBe('test');
    });

    it('handles empty data object', () => {
      const file = join(tmpDir, 'empty-data.md');
      writeFrontmatter(file, {}, '\n# Content\n');
      const raw = readFileSync(file, 'utf-8');
      expect(raw).toContain('# Content');
    });
  });

  describe('updateFrontmatterFields', () => {
    it('updates existing fields without touching body', () => {
      const file = join(tmpDir, 'update.md');
      writeFileSync(file, '---\nname: old\ntype: soul\n---\n\n# Body stays.\n');
      updateFrontmatterFields(file, { name: 'new' });
      const { data, content } = readFrontmatter(file);
      expect(data.name).toBe('new');
      expect(data.type).toBe('soul');
      expect(content).toContain('# Body stays.');
    });

    it('adds new fields to frontmatter', () => {
      const file = join(tmpDir, 'add.md');
      writeFileSync(file, '---\nname: test\n---\n\nBody.\n');
      updateFrontmatterFields(file, { version: '1.0', tags: ['ai'] });
      const { data } = readFrontmatter(file);
      expect(data.name).toBe('test');
      expect(data.version).toBe('1.0');
      expect(data.tags).toEqual(['ai']);
    });

    it('overwrites field values with updates', () => {
      const file = join(tmpDir, 'merge.md');
      writeFileSync(file, '---\nstatus: draft\npriority: low\n---\n\nBody.\n');
      updateFrontmatterFields(file, { status: 'active', priority: 'high' });
      const { data } = readFrontmatter(file);
      expect(data.status).toBe('active');
      expect(data.priority).toBe('high');
    });
  });
});
