import { Command } from 'commander';
import { select, input, Separator } from '@inquirer/prompts';
import chalk from 'chalk';

// ─── Types ───────────────────────────────────────────────────────────────────

interface MenuArg {
  name: string;
  type: 'input' | 'select';
  choices?: Array<{ value: string; name: string }>;
}

interface MenuItem {
  name: string;
  argv: string[];
  description: string;
  args?: MenuArg[];
}

// ─── Menu Definition ─────────────────────────────────────────────────────────

const SECTION_CHOICES = [
  { value: 'changelog', name: 'Changelog' },
  { value: 'notes', name: 'Notes' },
  { value: 'technical_details', name: 'Technical Details' },
  { value: 'constraints', name: 'Constraints & Decisions' },
  { value: 'user_stories', name: 'User Stories' },
  { value: 'acceptance_criteria', name: 'Acceptance Criteria' },
  { value: 'why', name: 'Why' },
];

const EXIT_SENTINEL = '__EXIT__';

const MENU_ITEMS: ReadonlyArray<MenuItem | Separator> = [
  new Separator(chalk.bold(' Setup')),
  {
    name: 'Initialize project',
    argv: ['init'],
    description: 'Create _agent_context/ directory',
  },
  {
    name: 'Install skill',
    argv: ['install-skill'],
    description: 'Install Claude Code skill + agents + hooks',
  },

  new Separator(chalk.bold(' Content')),
  {
    name: 'Add changelog entry',
    argv: ['core', 'changelog', 'add'],
    description: 'Record a changelog entry',
  },
  {
    name: 'Add release entry',
    argv: ['core', 'releases', 'add'],
    description: 'Record a versioned release',
  },
  {
    name: 'Create feature',
    argv: ['features', 'create'],
    description: 'Create a new feature document',
    args: [{ name: 'Feature name', type: 'input' }],
  },
  {
    name: 'Insert into feature',
    argv: ['features', 'insert'],
    description: 'Add content to a feature section',
    args: [
      { name: 'Feature name', type: 'input' },
      { name: 'Section', type: 'select', choices: SECTION_CHOICES },
    ],
  },
  {
    name: 'Create knowledge file',
    argv: ['knowledge', 'create'],
    description: 'Create a new knowledge document',
    args: [{ name: 'Knowledge name', type: 'input' }],
  },
  {
    name: 'Show knowledge index',
    argv: ['knowledge', 'index'],
    description: 'List all knowledge files with tags',
  },
  {
    name: 'Show knowledge tags',
    argv: ['knowledge', 'tags'],
    description: 'List standard knowledge tags',
  },
  {
    name: 'Create task',
    argv: ['tasks', 'create'],
    description: 'Create a new task',
    args: [{ name: 'Task name', type: 'input' }],
  },
  {
    name: 'Log task progress',
    argv: ['tasks', 'log'],
    description: 'Add a changelog entry to a task',
    args: [{ name: 'Task name', type: 'input' }],
  },
  {
    name: 'Complete task',
    argv: ['tasks', 'complete'],
    description: 'Mark a task as completed',
    args: [{ name: 'Task name', type: 'input' }],
  },

  new Separator(chalk.bold(' System')),
  {
    name: 'Sleep status',
    argv: ['sleep', 'status'],
    description: 'Show current sleep debt level',
  },
  {
    name: 'Add sleep debt',
    argv: ['sleep', 'add'],
    description: 'Record a debt-accumulating action',
    args: [
      { name: 'Score (1-3)', type: 'input' },
      { name: 'Description', type: 'input' },
    ],
  },
  {
    name: 'Complete consolidation',
    argv: ['sleep', 'done'],
    description: 'Mark consolidation done, reset debt',
    args: [{ name: 'Summary', type: 'input' }],
  },
  {
    name: 'Context snapshot',
    argv: ['snapshot'],
    description: 'Output full context snapshot',
  },
  {
    name: 'Doctor',
    argv: ['doctor'],
    description: 'Validate _agent_context/ structure',
  },

  new Separator(''),
  {
    name: chalk.dim('Exit'),
    argv: [EXIT_SENTINEL],
    description: '',
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function countMenuItems(): number {
  return MENU_ITEMS.filter(
    (item) => !(item instanceof Separator) && (item as MenuItem).argv[0] !== EXIT_SENTINEL,
  ).length;
}

async function collectArgs(args: MenuArg[]): Promise<string[] | null> {
  const collected: string[] = [];
  for (const arg of args) {
    if (arg.type === 'select' && arg.choices) {
      const value = await select({ message: arg.name + ':', choices: arg.choices });
      collected.push(value);
    } else {
      const value = await input({ message: arg.name + ':' });
      if (!value.trim()) return null;
      collected.push(value);
    }
  }
  return collected;
}

function buildChoices() {
  return MENU_ITEMS.map((item) => {
    if (item instanceof Separator) return item;
    return {
      value: item.argv,
      name: item.name,
      description: item.description || undefined,
    };
  });
}

// ─── Main ────────────────────────────────────────────────────────────────────

export async function startInteractive(_program: Command): Promise<void> {
  console.log(chalk.dim(`  v0.1.0 · ${countMenuItems()} commands available`));
  console.log(chalk.dim(`  Use arrow keys to navigate, Enter to select.\n`));

  const choices = buildChoices();

  while (true) {
    // 1. Show menu
    let selectedArgv: string[];
    try {
      selectedArgv = await select<string[]>({
        message: 'What would you like to do?',
        choices,
        loop: false,
        pageSize: 22,
      });
    } catch {
      // Ctrl+C during menu
      console.log(chalk.dim('\n  Until next session.\n'));
      process.exit(0);
    }

    // 2. Exit check
    if (selectedArgv[0] === EXIT_SENTINEL) {
      console.log(chalk.dim('\n  Until next session.\n'));
      process.exit(0);
    }

    // 3. Find menu item for arg collection
    const menuItem = (MENU_ITEMS as ReadonlyArray<MenuItem | Separator>).find(
      (item): item is MenuItem => !(item instanceof Separator) && item.argv === selectedArgv,
    );

    // 4. Collect required arguments
    let collectedArgs: string[] = [];
    if (menuItem?.args) {
      try {
        const result = await collectArgs(menuItem.args);
        if (result === null) {
          console.log(chalk.dim('  Cancelled.\n'));
          continue;
        }
        collectedArgs = result;
      } catch {
        // Ctrl+C during arg collection
        console.log(chalk.dim('  Cancelled.\n'));
        continue;
      }
    }

    // 5. Dispatch to Commander
    const fullArgv = [...selectedArgv, ...collectedArgs];
    console.log();

    try {
      const { createProgram } = await import('./index.js');
      const freshProgram = createProgram();
      freshProgram.exitOverride();
      freshProgram.configureOutput({
        writeErr: (str) => {
          if (!str.startsWith('error:')) {
            process.stderr.write(str);
          }
        },
      });
      await freshProgram.parseAsync(fullArgv, { from: 'user' });
    } catch (err: any) {
      if (err.code === 'commander.helpDisplayed' || err.code === 'commander.version') {
        // Fine — help or version was displayed
      } else {
        console.error(chalk.red(`  ✗ ${err.message}`));
      }
    }

    console.log(); // spacing before next menu
  }
}
