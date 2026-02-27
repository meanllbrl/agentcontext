import { Command } from 'commander';
import chalk from 'chalk';
import { ensureContextRoot } from '../../lib/context-path.js';
import { readSleepState, writeSleepState } from './sleep.js';
import { generateId } from '../../lib/id.js';
import { success, error, header, info } from '../../lib/format.js';

export function registerTriggerCommand(program: Command): void {
  const trigger = program
    .command('trigger')
    .description('Manage contextual reminders (prospective memory)');

  // --- add ---
  trigger
    .command('add')
    .argument('<when>', 'Context keyword(s) that activate this trigger')
    .argument('<remind...>', 'What to remind about')
    .option('-m, --max-fires <count>', 'Auto-expire after N triggers', '3')
    .option('-s, --source <source>', 'Source reference (e.g. memory.md#section)')
    .description('Create a contextual trigger')
    .action((when: string, remindParts: string[], opts: { maxFires: string; source?: string }) => {
      const maxFires = parseInt(opts.maxFires, 10);
      if (isNaN(maxFires) || maxFires < 1) {
        error('max-fires must be a positive integer.');
        return;
      }

      const remind = remindParts.join(' ').trim();
      if (!remind) {
        error('Reminder message is required.');
        return;
      }

      const root = ensureContextRoot();
      const state = readSleepState(root);

      state.triggers.push({
        id: generateId('trg'),
        when: when.trim(),
        remind,
        source: opts.source || null,
        created_at: new Date().toISOString(),
        fired_count: 0,
        max_fires: maxFires,
      });

      writeSleepState(root, state);
      success(`Trigger created: when "${when}" -> ${remind}`);
    });

  // --- list ---
  trigger
    .command('list')
    .description('Show active triggers')
    .action(() => {
      const root = ensureContextRoot();
      const state = readSleepState(root);

      const active = state.triggers.filter(t => t.fired_count < t.max_fires);
      if (active.length === 0) {
        info('No active triggers.');
        return;
      }

      console.log(header('Active Triggers'));
      for (const t of active) {
        const remaining = t.max_fires - t.fired_count;
        console.log(`  ${chalk.magentaBright(t.id)} ${chalk.dim(`(${remaining} fires left)`)}`);
        console.log(`    When: ${chalk.white(t.when)}`);
        console.log(`    Remind: ${t.remind}`);
        if (t.source) {
          console.log(`    Source: ${chalk.dim(t.source)}`);
        }
      }
    });

  // --- remove ---
  trigger
    .command('remove')
    .argument('<id>', 'Trigger ID to remove')
    .description('Remove a trigger')
    .action((id: string) => {
      const root = ensureContextRoot();
      const state = readSleepState(root);
      const before = state.triggers.length;
      state.triggers = state.triggers.filter(t => t.id !== id);
      if (state.triggers.length === before) {
        error(`Trigger not found: ${id}`);
        return;
      }
      writeSleepState(root, state);
      success(`Trigger removed: ${id}`);
    });
}
