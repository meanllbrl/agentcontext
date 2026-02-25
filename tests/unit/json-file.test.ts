import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  readJsonArray,
  writeJsonArray,
  insertToJsonArray,
  readJsonObject,
  writeJsonObject,
} from '../../src/lib/json-file.js';

function makeTmpDir(): string {
  const dir = join(tmpdir(), `ac-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe('json-file', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('readJsonArray', () => {
    it('reads a JSON array file', () => {
      const file = join(tmpDir, 'arr.json');
      writeFileSync(file, '[{"id": 1}, {"id": 2}]');
      const result = readJsonArray(file);
      expect(result).toEqual([{ id: 1 }, { id: 2 }]);
    });

    it('reads an empty array', () => {
      const file = join(tmpDir, 'empty.json');
      writeFileSync(file, '[]');
      expect(readJsonArray(file)).toEqual([]);
    });

    it('throws on non-array JSON (object)', () => {
      const file = join(tmpDir, 'obj.json');
      writeFileSync(file, '{"key": "value"}');
      expect(() => readJsonArray(file)).toThrow('Expected JSON array');
    });

    it('throws on non-array JSON (string)', () => {
      const file = join(tmpDir, 'str.json');
      writeFileSync(file, '"hello"');
      expect(() => readJsonArray(file)).toThrow('Expected JSON array');
    });

    it('throws on invalid JSON', () => {
      const file = join(tmpDir, 'bad.json');
      writeFileSync(file, 'not json at all');
      expect(() => readJsonArray(file)).toThrow();
    });

    it('throws on non-existent file', () => {
      expect(() => readJsonArray(join(tmpDir, 'nope.json'))).toThrow();
    });

    it('reads array of primitives', () => {
      const file = join(tmpDir, 'prims.json');
      writeFileSync(file, '[1, "two", true, null]');
      expect(readJsonArray(file)).toEqual([1, 'two', true, null]);
    });
  });

  describe('writeJsonArray', () => {
    it('writes pretty-formatted JSON with trailing newline', () => {
      const file = join(tmpDir, 'write.json');
      writeJsonArray(file, [{ a: 1 }]);
      const raw = readFileSync(file, 'utf-8');
      expect(raw).toBe('[\n  {\n    "a": 1\n  }\n]\n');
    });

    it('writes empty array', () => {
      const file = join(tmpDir, 'empty.json');
      writeJsonArray(file, []);
      const raw = readFileSync(file, 'utf-8');
      expect(raw).toBe('[]\n');
    });

    it('overwrites existing file', () => {
      const file = join(tmpDir, 'over.json');
      writeFileSync(file, '[1,2,3]');
      writeJsonArray(file, [4, 5]);
      expect(readJsonArray(file)).toEqual([4, 5]);
    });
  });

  describe('insertToJsonArray', () => {
    it('inserts at top (LIFO) by default', () => {
      const file = join(tmpDir, 'insert.json');
      writeFileSync(file, '[{"id": 1}]');
      insertToJsonArray(file, { id: 2 });
      const result = readJsonArray(file);
      expect(result).toEqual([{ id: 2 }, { id: 1 }]);
    });

    it('inserts at bottom when position=bottom', () => {
      const file = join(tmpDir, 'insert.json');
      writeFileSync(file, '[{"id": 1}]');
      insertToJsonArray(file, { id: 2 }, 'bottom');
      const result = readJsonArray(file);
      expect(result).toEqual([{ id: 1 }, { id: 2 }]);
    });

    it('inserts into empty array', () => {
      const file = join(tmpDir, 'empty.json');
      writeFileSync(file, '[]');
      insertToJsonArray(file, { id: 1 });
      expect(readJsonArray(file)).toEqual([{ id: 1 }]);
    });

    it('inserts multiple items maintaining order', () => {
      const file = join(tmpDir, 'multi.json');
      writeFileSync(file, '[]');
      insertToJsonArray(file, { id: 1 });
      insertToJsonArray(file, { id: 2 });
      insertToJsonArray(file, { id: 3 });
      expect(readJsonArray(file)).toEqual([{ id: 3 }, { id: 2 }, { id: 1 }]);
    });
  });

  describe('readJsonObject', () => {
    it('reads a JSON object file', () => {
      const file = join(tmpDir, 'obj.json');
      writeFileSync(file, '{"name": "test", "value": 42}');
      const result = readJsonObject(file);
      expect(result).toEqual({ name: 'test', value: 42 });
    });

    it('reads a nested object', () => {
      const file = join(tmpDir, 'nested.json');
      writeFileSync(file, '{"a": {"b": [1, 2]}}');
      const result = readJsonObject(file);
      expect(result).toEqual({ a: { b: [1, 2] } });
    });

    it('throws on array JSON', () => {
      const file = join(tmpDir, 'arr.json');
      writeFileSync(file, '[1, 2, 3]');
      expect(() => readJsonObject(file)).toThrow('Expected JSON object');
    });

    it('throws on string JSON', () => {
      const file = join(tmpDir, 'str.json');
      writeFileSync(file, '"hello"');
      expect(() => readJsonObject(file)).toThrow('Expected JSON object');
    });

    it('throws on null JSON', () => {
      const file = join(tmpDir, 'null.json');
      writeFileSync(file, 'null');
      expect(() => readJsonObject(file)).toThrow('Expected JSON object');
    });

    it('throws on invalid JSON', () => {
      const file = join(tmpDir, 'bad.json');
      writeFileSync(file, 'not json');
      expect(() => readJsonObject(file)).toThrow();
    });

    it('throws on non-existent file', () => {
      expect(() => readJsonObject(join(tmpDir, 'nope.json'))).toThrow();
    });
  });

  describe('writeJsonObject', () => {
    it('writes pretty-formatted JSON with trailing newline', () => {
      const file = join(tmpDir, 'write.json');
      writeJsonObject(file, { a: 1, b: 'two' });
      const raw = readFileSync(file, 'utf-8');
      expect(raw).toBe('{\n  "a": 1,\n  "b": "two"\n}\n');
    });

    it('overwrites existing file', () => {
      const file = join(tmpDir, 'over.json');
      writeFileSync(file, '{"old": true}');
      writeJsonObject(file, { new: true });
      const result = readJsonObject(file);
      expect(result).toEqual({ new: true });
    });

    it('writes empty object', () => {
      const file = join(tmpDir, 'empty.json');
      writeJsonObject(file, {});
      const raw = readFileSync(file, 'utf-8');
      expect(raw).toBe('{}\n');
    });
  });
});
