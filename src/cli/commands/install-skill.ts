import { Command } from 'commander';
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import chalk from 'chalk';
import { success, error, info, miniBox } from '../../lib/format.js';

const SESSION_START_HOOK = 'npx agentcontext hook session-start';
const STOP_HOOK = 'npx agentcontext hook stop';
const SUBAGENT_START_HOOK = 'npx agentcontext hook subagent-start';
const OLD_HOOK = 'npx agentcontext snapshot'; // migration target

interface HookHandler {
  type: string;
  command: string;
  timeout?: number;
  [key: string]: unknown;
}

interface MatcherGroup {
  matcher?: string;
  hooks: HookHandler[];
}

interface SettingsJson {
  hooks?: Record<string, MatcherGroup[]>;
  [key: string]: unknown;
}

/**
 * Ensure both SessionStart and Stop hooks are installed.
 * Migrates old `npx agentcontext snapshot` hook if present.
 */
function ensureHooks(projectRoot: string): { added: string[]; migrated: boolean } {
  const settingsPath = join(projectRoot, '.claude', 'settings.json');
  const result = { added: [] as string[], migrated: false };

  let settings: SettingsJson = {};
  if (existsSync(settingsPath)) {
    try {
      settings = JSON.parse(readFileSync(settingsPath, 'utf-8'));
    } catch {
      settings = {};
    }
  }

  if (!settings.hooks) {
    settings.hooks = {};
  }

  // --- SessionStart hook ---
  if (!settings.hooks.SessionStart) {
    settings.hooks.SessionStart = [];
  }

  // Migration: remove old `npx agentcontext snapshot` hook
  const oldIdx = settings.hooks.SessionStart.findIndex((group) =>
    group.hooks?.some((h) => h.command === OLD_HOOK),
  );
  if (oldIdx !== -1) {
    settings.hooks.SessionStart.splice(oldIdx, 1);
    result.migrated = true;
  }

  // Add new session-start hook if not present
  const hasSessionStart = settings.hooks.SessionStart.some((group) =>
    group.hooks?.some((h) => h.command === SESSION_START_HOOK),
  );
  if (!hasSessionStart) {
    settings.hooks.SessionStart.push({
      matcher: 'startup|resume|compact|clear',
      hooks: [
        {
          type: 'command',
          command: SESSION_START_HOOK,
          timeout: 10,
        },
      ],
    });
    result.added.push('SessionStart');
  }

  // --- Stop hook (no matcher — Stop doesn't support matchers) ---
  if (!settings.hooks.Stop) {
    settings.hooks.Stop = [];
  }

  const hasStop = settings.hooks.Stop.some((group) =>
    group.hooks?.some((h) => h.command === STOP_HOOK),
  );
  if (!hasStop) {
    settings.hooks.Stop.push({
      hooks: [
        {
          type: 'command',
          command: STOP_HOOK,
          timeout: 5,
        },
      ],
    });
    result.added.push('Stop');
  }

  // --- SubagentStart hook (no matcher — fires for all sub-agents) ---
  if (!settings.hooks.SubagentStart) {
    settings.hooks.SubagentStart = [];
  }

  const hasSubagentStart = settings.hooks.SubagentStart.some((group) =>
    group.hooks?.some((h) => h.command === SUBAGENT_START_HOOK),
  );
  if (!hasSubagentStart) {
    settings.hooks.SubagentStart.push({
      hooks: [
        {
          type: 'command',
          command: SUBAGENT_START_HOOK,
          timeout: 5,
        },
      ],
    });
    result.added.push('SubagentStart');
  }

  mkdirSync(join(projectRoot, '.claude'), { recursive: true });
  writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n', 'utf-8');
  return result;
}

const __dirname = fileURLToPath(new URL('.', import.meta.url));

function findPackageFile(subdir: string, filename: string): string | null {
  const candidates = [
    join(__dirname, '..', '..', '..', subdir, filename),
    join(__dirname, '..', '..', subdir, filename),
    join(__dirname, '..', subdir, filename),
  ];

  for (const path of candidates) {
    if (existsSync(path)) return path;
  }
  return null;
}

function findPackageDir(subdir: string): string | null {
  const candidates = [
    join(__dirname, '..', '..', '..', subdir),
    join(__dirname, '..', '..', subdir),
    join(__dirname, '..', subdir),
  ];

  for (const path of candidates) {
    if (existsSync(path)) return path;
  }
  return null;
}

export function registerInstallSkillCommand(program: Command): void {
  program
    .command('install-skill')
    .description('Install the agentcontext skill and agents for Claude Code (project-level)')
    .action(() => {
      try {
        const projectRoot = process.cwd();

        // 1. Install skill
        const skillSource = findPackageFile('skill', 'SKILL.md');
        if (!skillSource) {
          throw new Error('SKILL.md not found in package. Try reinstalling agentcontext.');
        }

        const skillDestDir = join(projectRoot, '.claude', 'skills', 'agentcontext');
        const skillDestFile = join(skillDestDir, 'SKILL.md');

        mkdirSync(skillDestDir, { recursive: true });
        writeFileSync(skillDestFile, readFileSync(skillSource, 'utf-8'), 'utf-8');

        const installed: string[] = [`.claude/skills/agentcontext/SKILL.md`];

        // 2. Install agents
        const agentsSourceDir = findPackageDir('agents');
        if (agentsSourceDir) {
          const agentsDestDir = join(projectRoot, '.claude', 'agents');
          mkdirSync(agentsDestDir, { recursive: true });

          const agentFiles = readdirSync(agentsSourceDir).filter((f) => f.endsWith('.md'));
          for (const file of agentFiles) {
            const source = join(agentsSourceDir, file);
            const dest = join(agentsDestDir, file);
            writeFileSync(dest, readFileSync(source, 'utf-8'), 'utf-8');
            installed.push(`.claude/agents/${file}`);
          }
        }

        // 3. Install hooks into .claude/settings.json
        const hookResult = ensureHooks(projectRoot);
        if (hookResult.added.length > 0) {
          installed.push(`.claude/settings.json ${chalk.dim(`(${hookResult.added.join(' + ')} hooks)`)}`);
        }

        const notes: string[] = [];
        if (hookResult.migrated) {
          notes.push(`  ${chalk.yellow('↑')} ${chalk.dim('Migrated old snapshot hook → session-start hook')}`);
        }
        if (hookResult.added.length === 0 && !hookResult.migrated) {
          notes.push(`  ${chalk.dim('Hooks already present — skipped')}`);
        }

        console.log();
        console.log(miniBox([
          chalk.green.bold('✓ Claude Code integration installed!'),
          '',
          ...installed.map((f) => `  ${chalk.green('✓')} ${chalk.magentaBright(f)}`),
          ...(notes.length > 0 ? ['', ...notes] : []),
        ], { color: 'green' }));
        console.log();
        info('Claude Code will auto-detect these when working in this project.');
      } catch (err: any) {
        error(err.message);
      }
    });
}
