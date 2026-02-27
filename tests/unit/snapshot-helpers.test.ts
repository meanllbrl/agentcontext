import { describe, it, expect } from 'vitest';
import { extractFirstParagraph } from '../../src/cli/commands/snapshot.js';

describe('extractFirstParagraph', () => {
  it('extracts first paragraph from markdown content', () => {
    const content = `# JWT Auth Flow

JWT authentication uses RS256 with 24h access tokens and 7d refresh tokens.
The refresh flow uses httpOnly cookies with strict SameSite policy.

## Details

More content here.`;

    const result = extractFirstParagraph(content);
    expect(result).toContain('JWT authentication uses RS256');
    expect(result).toContain('httpOnly cookies');
    expect(result).not.toContain('## Details');
  });

  it('returns empty string for heading-only content', () => {
    const content = `# Title

## Section 1

## Section 2`;

    const result = extractFirstParagraph(content);
    expect(result).toBe('');
  });

  it('caps long paragraphs at 300 chars', () => {
    const content = 'A'.repeat(400);
    const result = extractFirstParagraph(content);
    expect(result.length).toBeLessThanOrEqual(300);
    expect(result).toContain('...');
  });

  it('skips frontmatter markers', () => {
    const content = `---
name: Test
---

First paragraph of content.

Second paragraph.`;

    const result = extractFirstParagraph(content);
    expect(result).toBe('First paragraph of content.');
  });

  it('handles empty content', () => {
    expect(extractFirstParagraph('')).toBe('');
    expect(extractFirstParagraph('\n\n\n')).toBe('');
  });

  it('joins multi-line paragraphs', () => {
    const content = `# Title

Line one of paragraph.
Line two of paragraph.
Line three.

Next paragraph.`;

    const result = extractFirstParagraph(content);
    expect(result).toBe('Line one of paragraph. Line two of paragraph. Line three.');
  });
});
