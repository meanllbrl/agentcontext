import { Command } from 'commander';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { input, select } from '@inquirer/prompts';
import fg from 'fast-glob';
import { ensureContextRoot } from '../../lib/context-path.js';
import { updateFrontmatterFields } from '../../lib/frontmatter.js';
import { insertToSection } from '../../lib/markdown.js';
import { generateId, slugify, today } from '../../lib/id.js';
import { success, error } from '../../lib/format.js';

function getStateDir(): string {
  const root = ensureContextRoot();
  return join(root, 'state');
}

function findTaskFile(name: string): string | null {
  const dir = getStateDir();
  const slug = slugify(name);

  const exact = join(dir, `${slug}.md`);
  if (existsSync(exact)) return exact;

  // Prefer exact match, then prefix, then substring
  const files = fg.sync('*.md', { cwd: dir, absolute: true });

  const exactGlob = files.find((f) => basename(f, '.md') === slug);
  if (exactGlob) return exactGlob;

  const prefixMatches = files.filter((f) => basename(f, '.md').startsWith(slug));
  if (prefixMatches.length === 1) return prefixMatches[0];
  if (prefixMatches.length > 1) {
    error(`Ambiguous task name "${name}". Did you mean: ${prefixMatches.map(f => basename(f, '.md')).join(', ')}?`);
    return null;
  }

  const substringMatches = files.filter((f) => basename(f, '.md').includes(slug));
  if (substringMatches.length === 1) return substringMatches[0];
  if (substringMatches.length > 1) {
    error(`Ambiguous task name "${name}". Did you mean: ${substringMatches.map(f => basename(f, '.md')).join(', ')}?`);
    return null;
  }

  return null;
}

export function registerTasksCommand(program: Command): void {
  const tasks = program
    .command('tasks')
    .description('Create tasks, log progress, and mark complete');

  // Create task
  tasks
    .command('create')
    .argument('<name>')
    .description('Create a new task')
    .option('-d, --description <desc>', 'Task description')
    .option('-p, --priority <priority>', 'Priority (critical, high, medium, low)')
    .action(async (name: string, opts: { description?: string; priority?: string }) => {
      const dir = getStateDir();
      const slug = slugify(name);
      const filePath = join(dir, `${slug}.md`);

      if (existsSync(filePath)) {
        error(`Task already exists: ${slug}.md`);
        return;
      }

      const description = opts.description || await input({ message: 'Description:' });

      const priority = opts.priority || await select({
        message: 'Priority:',
        choices: [
          { value: 'medium', name: 'Medium' },
          { value: 'high', name: 'High' },
          { value: 'critical', name: 'Critical' },
          { value: 'low', name: 'Low' },
        ],
      });

      const dateStr = today();
      const content = `---
id: "${generateId('task')}"
name: "${name}"
description: "${description}"
priority: "${priority}"
status: "todo"
created_at: "${dateStr}"
updated_at: "${dateStr}"
tags: []
parent_task: null
---

## Changelog
<!-- LIFO: newest entry at top -->

### ${dateStr} - Created
- Task created.
`;

      writeFileSync(filePath, content, 'utf-8');
      success(`Task created: ${slug}.md`);
    });

  // Complete task
  tasks
    .command('complete')
    .argument('<name>')
    .argument('[summary...]', 'Completion summary')
    .description('Mark a task as completed')
    .action(async (name: string, summaryParts: string[]) => {
      const file = findTaskFile(name);
      if (!file) {
        error(`Task not found: ${name}`);
        return;
      }

      let summary: string;
      if (summaryParts.length > 0) {
        summary = summaryParts.join(' ');
      } else {
        summary = await input({ message: 'Completion summary (optional):', default: 'Task completed.' });
      }

      // Add final changelog entry
      const logContent = `### ${today()} - Completed\n- ${summary}`;
      try {
        insertToSection(file, 'Changelog', logContent, 'top');
      } catch {
        // If no changelog section, just append
        const existing = readFileSync(file, 'utf-8');
        writeFileSync(file, existing.trimEnd() + '\n\n' + logContent + '\n', 'utf-8');
      }

      updateFrontmatterFields(file, {
        status: 'completed',
        updated_at: today(),
      });

      success(`Task completed: ${basename(file, '.md')}`);
    });

  // Log entry (cross-session continuity)
  tasks
    .command('log')
    .argument('<name>')
    .argument('[content...]', 'Log entry content')
    .description('Add a changelog entry to a task (cross-session continuity)')
    .action(async (name: string, contentParts: string[]) => {
      const file = findTaskFile(name);
      if (!file) {
        error(`Task not found: ${name}`);
        return;
      }

      let content: string;
      if (contentParts.length > 0) {
        content = contentParts.join(' ');
      } else {
        content = await input({ message: 'Log entry:' });
      }

      if (!content.trim()) {
        error('No content provided.');
        return;
      }

      const logContent = `### ${today()} - Session Update\n- ${content}`;

      try {
        insertToSection(file, 'Changelog', logContent, 'top');
      } catch {
        const existing = readFileSync(file, 'utf-8');
        writeFileSync(file, existing.trimEnd() + '\n\n' + logContent + '\n', 'utf-8');
      }

      updateFrontmatterFields(file, { updated_at: today() });
      success(`Log entry added to ${basename(file, '.md')}`);
    });
}
