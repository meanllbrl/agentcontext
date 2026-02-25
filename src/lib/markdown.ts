import { readFileSync, writeFileSync } from 'node:fs';
import matter from 'gray-matter';

interface Section {
  name: string;
  level: number;
  startLine: number;
  endLine: number;
}

/**
 * Parse a markdown file into sections based on ## headers.
 * Only top-level (##) headers create sections. Sub-headers (###, ####, etc.)
 * are part of the parent section's content.
 */
function parseSections(content: string): Section[] {
  const lines = content.split('\n');
  const sections: Section[] = [];

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^(#{2})\s+(.+)$/);
    if (match) {
      if (sections.length > 0) {
        sections[sections.length - 1].endLine = i - 1;
      }
      sections.push({
        name: match[2].trim(),
        level: match[1].length,
        startLine: i,
        endLine: lines.length - 1,
      });
    }
  }

  return sections;
}

/**
 * Normalize a section name for comparison.
 */
function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Find a section by name (case-insensitive, ignores special chars).
 */
function findSection(sections: Section[], sectionName: string): Section | null {
  const normalized = normalizeName(sectionName);
  return (
    sections.find((s) => normalizeName(s.name) === normalized) ?? null
  );
}

/**
 * List all section names in a markdown file.
 */
export function listSections(filePath: string): string[] {
  const raw = readFileSync(filePath, 'utf-8');
  const parsed = matter(raw);
  const sections = parseSections(parsed.content);
  return sections.map((s) => s.name);
}

/**
 * Read the content of a specific section.
 */
export function readSection(filePath: string, sectionName: string): string | null {
  const raw = readFileSync(filePath, 'utf-8');
  const parsed = matter(raw);
  const sections = parseSections(parsed.content);
  const section = findSection(sections, sectionName);
  if (!section) return null;

  const lines = parsed.content.split('\n');
  // Return lines after the header, up to the end of the section
  const bodyLines = lines.slice(section.startLine + 1, section.endLine + 1);
  return bodyLines.join('\n').trim();
}

/**
 * Insert content into a specific section.
 * position 'top' = right after the header (LIFO), 'bottom' = before the next section.
 */
export function insertToSection(
  filePath: string,
  sectionName: string,
  newContent: string,
  position: 'top' | 'bottom' = 'top',
): void {
  const raw = readFileSync(filePath, 'utf-8');
  const parsed = matter(raw);
  const lines = parsed.content.split('\n');
  const sections = parseSections(parsed.content);
  const section = findSection(sections, sectionName);

  if (!section) {
    throw new Error(`Section "${sectionName}" not found in ${filePath}`);
  }

  // Find the insertion point
  let insertAt: number;

  if (position === 'top') {
    // Insert right after the header line (skip HTML comments)
    insertAt = section.startLine + 1;
    while (
      insertAt <= section.endLine &&
      (lines[insertAt]?.trim().startsWith('<!--') || lines[insertAt]?.trim() === '')
    ) {
      insertAt++;
    }
  } else {
    insertAt = section.endLine + 1;
  }

  // Insert the new content
  const contentLines = newContent.split('\n');
  lines.splice(insertAt, 0, '', ...contentLines);

  // Reconstruct the file with frontmatter
  const output = matter.stringify(lines.join('\n'), parsed.data);
  writeFileSync(filePath, output, 'utf-8');
}
