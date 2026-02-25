import { Command } from 'commander';
import { join } from 'node:path';
import { input, select } from '@inquirer/prompts';
import { ensureContextRoot } from '../../lib/context-path.js';
import { insertToJsonArray } from '../../lib/json-file.js';
import { today } from '../../lib/id.js';
import { success } from '../../lib/format.js';

export function registerCoreCommand(program: Command): void {
  const core = program
    .command('core')
    .description('Add changelog and release entries');

  // Changelog operations
  const changelog = core
    .command('changelog')
    .description('Manage CHANGELOG.json');

  changelog
    .command('add')
    .description('Add a changelog entry')
    .action(async () => {
      const root = ensureContextRoot();
      const filePath = join(root, 'core', 'CHANGELOG.json');

      const type = await select({
        message: 'Type:',
        choices: [
          { value: 'feat', name: 'feat - New feature' },
          { value: 'fix', name: 'fix - Bug fix' },
          { value: 'refactor', name: 'refactor - Code restructure' },
          { value: 'chore', name: 'chore - Maintenance' },
          { value: 'docs', name: 'docs - Documentation' },
          { value: 'perf', name: 'perf - Performance' },
          { value: 'test', name: 'test - Tests' },
        ],
      });

      const scope = await input({ message: 'Scope (e.g., auth, ui, api):' });
      const description = await input({ message: 'Description:' });
      const breaking = await select({
        message: 'Breaking change?',
        choices: [
          { value: false, name: 'No' },
          { value: true, name: 'Yes' },
        ],
      });

      insertToJsonArray(filePath, {
        date: today(),
        type,
        scope,
        description,
        breaking,
      });

      success('Changelog entry added.');
    });

  // Releases operations
  const releases = core
    .command('releases')
    .description('Manage RELEASES.json');

  releases
    .command('add')
    .description('Add a release entry')
    .action(async () => {
      const root = ensureContextRoot();
      const filePath = join(root, 'core', 'RELEASES.json');

      const version = await input({ message: 'Version (e.g., 1.2.0):' });
      const summary = await input({ message: 'Summary:' });
      const changesStr = await input({
        message: 'Changes (comma-separated):',
      });
      const changes = changesStr.split(',').map((c) => c.trim()).filter(Boolean);

      insertToJsonArray(filePath, {
        version,
        date: today(),
        summary,
        changes,
        breaking: false,
      });

      success(`Release ${version} recorded.`);
    });
}
