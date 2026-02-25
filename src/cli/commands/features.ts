import { Command } from 'commander';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { input } from '@inquirer/prompts';
import fg from 'fast-glob';
import { ensureContextRoot } from '../../lib/context-path.js';
import { updateFrontmatterFields } from '../../lib/frontmatter.js';
import { insertToSection } from '../../lib/markdown.js';
import { generateId, slugify, today } from '../../lib/id.js';
import { success, error } from '../../lib/format.js';

function getFeaturesDir(): string {
  const root = ensureContextRoot();
  return join(root, 'core', 'features');
}

function findFeatureFile(name: string): string | null {
  const dir = getFeaturesDir();
  const slug = slugify(name);

  // Try exact match first
  const exact = join(dir, `${slug}.md`);
  if (existsSync(exact)) return exact;

  // Try glob match: prefer exact, then prefix, then substring
  const files = fg.sync('*.md', { cwd: dir, absolute: true });

  const exactGlob = files.find((f) => basename(f, '.md') === slug);
  if (exactGlob) return exactGlob;

  const prefixMatches = files.filter((f) => basename(f, '.md').startsWith(slug));
  if (prefixMatches.length === 1) return prefixMatches[0];
  if (prefixMatches.length > 1) {
    error(`Ambiguous feature name "${name}". Did you mean: ${prefixMatches.map(f => basename(f, '.md')).join(', ')}?`);
    return null;
  }

  const substringMatches = files.filter((f) => basename(f, '.md').includes(slug));
  if (substringMatches.length === 1) return substringMatches[0];
  if (substringMatches.length > 1) {
    error(`Ambiguous feature name "${name}". Did you mean: ${substringMatches.map(f => basename(f, '.md')).join(', ')}?`);
    return null;
  }

  return null;
}

function getFeatureTemplate(): string {
  // Try to load from templates directory
  const candidates = [
    join(new URL('.', import.meta.url).pathname, '..', '..', 'templates', 'feature.md'),
    join(new URL('.', import.meta.url).pathname, '..', 'templates', 'feature.md'),
  ];

  for (const path of candidates) {
    if (existsSync(path)) {
      return readFileSync(path, 'utf-8');
    }
  }

  // Inline fallback
  return `---
id: "{{ID}}"
status: "planning"
created: "{{DATE}}"
updated: "{{DATE}}"
released_version: null
tags: []
related_tasks: []
---

## Why

{{WHY}}

## User Stories

- [ ] As a [user], I want [action] so that [outcome]

## Acceptance Criteria

- (Specific, testable conditions for this feature to be complete)

## Constraints & Decisions
<!-- LIFO: newest decision at top -->

## Technical Details

(How this feature is wired. Key files, services, dependencies, flows.)

## Notes

(Edge cases, open questions, future considerations.)

## Changelog
<!-- LIFO: newest entry at top -->

### {{DATE}} - Created
- Feature PRD created.
`;
}

export function registerFeaturesCommand(program: Command): void {
  const features = program
    .command('features')
    .description('Create features and insert into sections');

  // Create a feature
  features
    .command('create')
    .argument('<name>')
    .option('-w, --why <why>', 'Why are we building this?')
    .description('Create a new feature document')
    .action(async (name: string, opts: { why?: string }) => {
      const dir = getFeaturesDir();
      const slug = slugify(name);
      const filePath = join(dir, `${slug}.md`);

      if (existsSync(filePath)) {
        error(`Feature already exists: ${slug}.md`);
        return;
      }

      const why = opts.why || await input({ message: 'Why are we building this?' });

      const template = getFeatureTemplate();
      const content = template
        .replaceAll('{{ID}}', generateId('feat'))
        .replaceAll('{{DATE}}', today())
        .replaceAll('{{WHY}}', why || '(To be defined)');

      writeFileSync(filePath, content, 'utf-8');
      success(`Feature created: ${slug}.md`);
    });

  // Insert into a section
  features
    .command('insert')
    .argument('<name>')
    .argument(
      '<section>',
      'Section: changelog, notes, technical_details, constraints, user_stories, acceptance_criteria',
    )
    .argument('[content...]', 'Content to insert')
    .description('Insert content into a feature section')
    .action(async (name: string, section: string, contentParts: string[]) => {
      const file = findFeatureFile(name);
      if (!file) {
        error(`Feature not found: ${name}`);
        return;
      }

      // Map section shortcuts to actual header names
      const sectionMap: Record<string, string> = {
        changelog: 'Changelog',
        notes: 'Notes',
        technical_details: 'Technical Details',
        constraints: 'Constraints & Decisions',
        user_stories: 'User Stories',
        acceptance_criteria: 'Acceptance Criteria',
        why: 'Why',
      };

      const sectionKey = section.toLowerCase();
      if (!sectionMap[sectionKey]) {
        error(`Unknown section: "${section}". Valid sections: ${Object.keys(sectionMap).join(', ')}`);
        return;
      }
      const sectionName = sectionMap[sectionKey];

      let content: string;
      if (contentParts.length > 0) {
        content = contentParts.join(' ');
      } else {
        content = await input({ message: `Content for ${sectionName}:` });
      }

      if (!content.trim()) {
        error('No content provided.');
        return;
      }

      // For changelog, auto-prepend date header
      if (section.toLowerCase() === 'changelog') {
        content = `### ${today()} - Update\n- ${content}`;
      }

      // For constraints, prepend with date
      if (section.toLowerCase() === 'constraints') {
        content = `- **[${today()}]** ${content}`;
      }

      const position =
        ['changelog', 'constraints'].includes(section.toLowerCase())
          ? 'top'
          : 'bottom';

      try {
        insertToSection(file, sectionName, content, position as 'top' | 'bottom');
        updateFrontmatterFields(file, { updated: today() });
        success(`Inserted into ${sectionName} in ${basename(file)}`);
      } catch (err: any) {
        error(err.message);
      }
    });
}
