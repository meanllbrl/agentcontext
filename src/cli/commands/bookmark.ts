import { Command } from 'commander';
import chalk from 'chalk';
import { ensureContextRoot } from '../../lib/context-path.js';
import { readSleepState, writeSleepState } from './sleep.js';
import { generateId } from '../../lib/id.js';
import { success, error, header } from '../../lib/format.js';

const SALIENCE_LABELS: Record<number, string> = {
  1: '★',
  2: '★★',
  3: '★★★',
};

export function registerBookmarkCommand(program: Command): void {
  const bookmark = program
    .command('bookmark')
    .description('Tag important moments for consolidation (awake ripples)');

  // --- add (default) ---
  bookmark
    .command('add')
    .argument('<message...>', 'What to remember')
    .option('-s, --salience <level>', 'Importance level (1=notable, 2=significant, 3=critical)', '2')
    .description('Create a bookmark')
    .action((messageParts: string[], opts: { salience: string }) => {
      const salience = parseInt(opts.salience, 10);
      if (![1, 2, 3].includes(salience)) {
        error('Salience must be 1, 2, or 3.');
        return;
      }

      const message = messageParts.join(' ').trim();
      if (!message) {
        error('Message is required.');
        return;
      }

      const root = ensureContextRoot();
      const state = readSleepState(root);

      state.bookmarks.unshift({
        id: generateId('bm'),
        message,
        salience: salience as 1 | 2 | 3,
        created_at: new Date().toISOString(),
        session_id: null, // linked by stop hook later
      });

      writeSleepState(root, state);
      success(`${SALIENCE_LABELS[salience]} Bookmarked: ${message}`);
    });

  // --- list ---
  bookmark
    .command('list')
    .description('Show current bookmarks')
    .action(() => {
      const root = ensureContextRoot();
      const state = readSleepState(root);

      if (state.bookmarks.length === 0) {
        console.log(chalk.dim('No bookmarks.'));
        return;
      }

      console.log(header('Bookmarks'));
      for (const b of state.bookmarks) {
        const stars = SALIENCE_LABELS[b.salience] || '★';
        const time = chalk.dim(b.created_at.split('T')[0]);
        console.log(`  ${stars} ${time} ${b.message}`);
      }
    });

  // --- clear ---
  bookmark
    .command('clear')
    .description('Remove all bookmarks')
    .action(() => {
      const root = ensureContextRoot();
      const state = readSleepState(root);
      const count = state.bookmarks.length;
      state.bookmarks = [];
      writeSleepState(root, state);
      success(`Cleared ${count} bookmark(s).`);
    });
}
