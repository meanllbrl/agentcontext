import { Command } from 'commander';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import chalk from 'chalk';
import { ensureContextRoot } from '../../lib/context-path.js';
import { readJsonObject, writeJsonObject } from '../../lib/json-file.js';
import { today } from '../../lib/id.js';
import { header, success, error, warn, info } from '../../lib/format.js';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface SessionRecord {
  session_id: string;
  transcript_path: string | null;
  stopped_at: string | null;
  last_assistant_message: string | null;
  change_count: number | null;
  score: number | null;
}

export interface FieldChange {
  field: string;
  from: string | number | boolean | string[] | null;
  to: string | number | boolean | string[] | null;
}

export interface DashboardChange {
  timestamp: string;
  entity: 'task' | 'core' | 'knowledge' | 'feature' | 'sleep';
  action: 'create' | 'update' | 'delete';
  target: string;
  field?: string;
  fields?: FieldChange[];
  summary: string;
}

export interface SleepState {
  debt: number;
  last_sleep: string | null;
  last_sleep_summary: string | null;
  sleep_started_at: string | null;
  sessions: SessionRecord[];
  dashboard_changes: DashboardChange[];
}

const DEFAULT_SLEEP_STATE: SleepState = {
  debt: 0,
  last_sleep: null,
  last_sleep_summary: null,
  sleep_started_at: null,
  sessions: [],
  dashboard_changes: [],
};

// ─── Helpers ───────────────────────────────────────────────────────────────

function getSleepPath(root: string): string {
  return join(root, 'state', '.sleep.json');
}

/**
 * Read sleep state from disk. Returns defaults if file is missing or malformed.
 * Exported for use by snapshot and hook.
 */
export function readSleepState(root: string): SleepState {
  const filePath = getSleepPath(root);
  if (!existsSync(filePath)) {
    return { ...DEFAULT_SLEEP_STATE, sessions: [] };
  }
  try {
    const parsed = readJsonObject<Partial<SleepState>>(filePath);
    return {
      ...DEFAULT_SLEEP_STATE,
      ...parsed,
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      dashboard_changes: Array.isArray(parsed.dashboard_changes) ? parsed.dashboard_changes as DashboardChange[] : [],
    };
  } catch {
    return { ...DEFAULT_SLEEP_STATE, sessions: [] };
  }
}

export function writeSleepState(root: string, state: SleepState): void {
  const filePath = getSleepPath(root);
  writeJsonObject(filePath, state);
}

function getSleepinessLevel(debt: number): string {
  if (debt <= 3) return 'Alert';
  if (debt <= 6) return 'Drowsy';
  if (debt <= 9) return 'Sleepy';
  return 'Must Sleep';
}

function getSleepinessRange(debt: number): string {
  if (debt <= 3) return '0-3';
  if (debt <= 6) return '4-6';
  if (debt <= 9) return '7-9';
  return '10+';
}

// ─── Command Registration ──────────────────────────────────────────────────

export function registerSleepCommand(program: Command): void {
  const sleep = program
    .command('sleep')
    .description('Track sleep debt and consolidation state');

  // --- status ---
  sleep
    .command('status')
    .description('Show current sleep debt level and history')
    .action(() => {
      const root = ensureContextRoot();
      const state = readSleepState(root);
      const level = getSleepinessLevel(state.debt);
      const range = getSleepinessRange(state.debt);

      console.log(header('Sleep State'));
      console.log(`  Debt:       ${chalk.bold(String(state.debt))} ${chalk.dim(`(${range})`)} ${chalk.magentaBright(level)}`);
      console.log(`  Last sleep: ${state.last_sleep ? chalk.white(state.last_sleep) : chalk.dim('never')}`);
      if (state.last_sleep_summary) {
        console.log(`  Summary:    ${chalk.dim(state.last_sleep_summary)}`);
      }

      if (state.sessions.length > 0) {
        console.log(`\n  ${chalk.bold('Sessions since last sleep:')}`);
        for (const s of state.sessions) {
          const scoreStr = s.score !== null ? chalk.yellow(`+${s.score}`) : chalk.dim('pending');
          const changesStr = s.change_count !== null ? chalk.dim(`[${s.change_count} changes]`) : '';
          const timeStr = s.stopped_at ? chalk.dim(s.stopped_at) : chalk.dim('active');
          console.log(`  ${timeStr} ${scoreStr} ${changesStr}`);
          if (s.last_assistant_message) {
            const preview = s.last_assistant_message.length > 120
              ? s.last_assistant_message.slice(0, 120) + '...'
              : s.last_assistant_message;
            console.log(`    ${chalk.dim('"' + preview + '"')}`);
          }
        }
      } else {
        console.log(chalk.dim('\n  No sessions since last sleep.'));
      }
    });

  // --- add ---
  sleep
    .command('add')
    .argument('<score>', 'Debt score to add (1-3)')
    .argument('<description...>', 'Description of what happened')
    .description('Record a debt-accumulating action')
    .action((scoreStr: string, descParts: string[]) => {
      const score = parseInt(scoreStr, 10);
      if (isNaN(score) || score < 1 || score > 3) {
        error('Score must be 1, 2, or 3.');
        return;
      }

      const description = descParts.join(' ');
      if (!description.trim()) {
        error('Description is required.');
        return;
      }

      const root = ensureContextRoot();
      const state = readSleepState(root);

      state.sessions.unshift({
        session_id: `manual-${Date.now()}`,
        transcript_path: null,
        stopped_at: new Date().toISOString(),
        last_assistant_message: description.trim(),
        change_count: null,
        score,
      });
      state.debt += score;

      writeSleepState(root, state);

      const level = getSleepinessLevel(state.debt);
      success(`Sleep debt: ${state.debt} (${level})`);

      if (state.debt >= 10) {
        warn('Must sleep! Debt is 10+. Consolidation needed.');
      } else if (state.debt >= 7) {
        info('Getting sleepy. Consider consolidating soon.');
      }
    });

  // --- start ---
  sleep
    .command('start')
    .description('Mark beginning of consolidation (sets epoch for safe clearing)')
    .action(() => {
      const root = ensureContextRoot();
      const state = readSleepState(root);

      if (state.sleep_started_at) {
        warn(`Consolidation already in progress (started ${state.sleep_started_at}). Overwriting epoch.`);
      }

      state.sleep_started_at = new Date().toISOString();
      writeSleepState(root, state);
      success(`Consolidation epoch set: ${state.sleep_started_at}`);
    });

  // --- done ---
  sleep
    .command('done')
    .argument('<summary...>', 'Summary of what was consolidated')
    .description('Mark consolidation complete, reset debt')
    .action((summaryParts: string[]) => {
      const summary = summaryParts.join(' ');
      if (!summary.trim()) {
        error('Summary is required.');
        return;
      }

      const root = ensureContextRoot();
      const state = readSleepState(root);
      const previousDebt = state.debt;
      const epoch = state.sleep_started_at;

      if (epoch) {
        // Epoch-based: only clear sessions/changes from before sleep started
        state.sessions = state.sessions.filter(s => {
          if (!s.stopped_at) return false;
          return s.stopped_at > epoch;
        });
        state.dashboard_changes = state.dashboard_changes.filter(c => c.timestamp > epoch);
        state.debt = state.sessions.reduce((sum, s) => sum + (s.score ?? 0), 0);
      } else {
        // Backward compat: no epoch, clear everything
        state.sessions = [];
        state.dashboard_changes = [];
        state.debt = 0;
      }

      state.last_sleep = today();
      state.last_sleep_summary = summary.trim();
      state.sleep_started_at = null;

      writeSleepState(root, state);

      if (epoch && state.sessions.length > 0) {
        success(`Consolidation complete. Debt reduced from ${previousDebt} to ${state.debt}. ${state.sessions.length} post-epoch session(s) preserved.`);
      } else {
        success(`Consolidation complete. Debt reset from ${previousDebt} to ${state.debt}.`);
      }
    });

  // --- debt ---
  sleep
    .command('debt')
    .description('Output current debt number (for programmatic use)')
    .action(() => {
      const root = ensureContextRoot();
      const state = readSleepState(root);
      console.log(String(state.debt));
    });
}
