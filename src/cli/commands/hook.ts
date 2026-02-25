import { Command } from 'commander';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolveContextRoot } from '../../lib/context-path.js';
import { readSleepState, writeSleepState } from './sleep.js';
import { generateSnapshot, generateSubagentBriefing } from './snapshot.js';

// ─── Constants ──────────────────────────────────────────────────────────────

const MAX_TRANSCRIPT_BYTES = 50 * 1024 * 1024; // 50MB safety cap

// ─── Stdin Reading ──────────────────────────────────────────────────────────

/**
 * Read JSON object from stdin (piped by Claude Code hooks).
 * Returns null if stdin is a TTY, empty, or invalid JSON.
 */
function readStdin(): Record<string, unknown> | null {
  if (process.stdin.isTTY) return null;
  try {
    const raw = readFileSync(0, 'utf-8');
    if (!raw.trim()) return null;
    const parsed = JSON.parse(raw);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

// ─── Transcript Analysis ────────────────────────────────────────────────────

/**
 * Count Write and Edit tool uses in a JSONL transcript file.
 * Returns the raw count (not the score). Returns 0 on any error.
 */
export function analyzeTranscript(transcriptPath: string): number {
  if (!existsSync(transcriptPath)) return 0;
  try {
    const stat = statSync(transcriptPath);
    if (stat.size === 0 || stat.size > MAX_TRANSCRIPT_BYTES) return 0;
    const content = readFileSync(transcriptPath, 'utf-8');
    const matches = content.match(/"name"\s*:\s*"(?:Write|Edit)"/g);
    return matches ? matches.length : 0;
  } catch {
    return 0;
  }
}

/**
 * Map a raw change count to a debt score (0-3).
 */
export function scoreFromChangeCount(count: number): number {
  if (count <= 0) return 0;
  if (count <= 3) return 1;
  if (count <= 8) return 2;
  return 3;
}

// ─── Consolidation Directives ───────────────────────────────────────────────

function getConsolidationDirective(debt: number): string | null {
  if (debt >= 10) {
    return [
      '>>> CONSOLIDATION STRONGLY RECOMMENDED <<<',
      '',
      `Sleep debt is ${debt} (threshold: 10). Context files are likely stale and bloated.`,
      'Consolidation will improve context quality for this and future sessions.',
      'Dispatch the agentcontext-rem-sleep agent with a brief of recent work.',
      'If the user has an urgent task, proceed but consolidate at the earliest opportunity.',
      '',
    ].join('\n');
  }
  if (debt >= 7) {
    return [
      '>> NOTE: Sleep debt is elevated <<',
      '',
      `Sleep debt is ${debt}/10. Consider consolidating soon.`,
      'Dispatch the agentcontext-rem-sleep agent with a brief of recent work.',
      '',
    ].join('\n');
  }
  return null;
}

// ─── Command Registration ───────────────────────────────────────────────────

export function registerHookCommand(program: Command): void {
  const hook = program
    .command('hook')
    .description('Hook handlers for Claude Code (stop, session-start)');

  // --- hook stop ---
  hook
    .command('stop')
    .description('Record session metadata (called by Claude Code Stop hook)')
    .action(() => {
      const input = readStdin();
      if (!input) {
        if (process.stdin.isTTY) {
          console.error('This command is called by the Claude Code Stop hook.');
          console.error('It reads JSON from stdin and should not be called manually.');
        }
        process.exit(0);
      }

      const root = resolveContextRoot();
      if (!root) process.exit(0);

      const sessionId = typeof input.session_id === 'string' ? input.session_id : null;
      const transcriptPath = typeof input.transcript_path === 'string' ? input.transcript_path : null;
      const lastAssistantMessage = typeof input.last_assistant_message === 'string'
        ? input.last_assistant_message : null;

      if (!sessionId) process.exit(0);

      const state = readSleepState(root);
      const stoppedAt = new Date().toISOString();

      // Analyze transcript immediately so change_count and score are populated at write time
      const changeCount = transcriptPath ? analyzeTranscript(transcriptPath) : 0;
      const score = scoreFromChangeCount(changeCount);

      // Check if session already exists (e.g., stop fired twice for same session)
      const existing = state.sessions.findIndex(s => s.session_id === sessionId);
      if (existing >= 0) {
        // Subtract old score before updating (avoid double-counting on re-stop)
        const oldScore = state.sessions[existing].score ?? 0;
        state.debt = Math.max(0, state.debt - oldScore);

        state.sessions[existing].transcript_path = transcriptPath;
        state.sessions[existing].stopped_at = stoppedAt;
        state.sessions[existing].last_assistant_message = lastAssistantMessage;
        state.sessions[existing].change_count = changeCount;
        state.sessions[existing].score = score;
      } else {
        state.sessions.unshift({
          session_id: sessionId,
          transcript_path: transcriptPath,
          stopped_at: stoppedAt,
          last_assistant_message: lastAssistantMessage,
          change_count: changeCount,
          score,
        });
      }

      // Add current score to debt
      state.debt += score;

      writeSleepState(root, state);
    });

  // --- hook session-start ---
  hook
    .command('session-start')
    .description('Analyze previous session + output context snapshot (called by Claude Code SessionStart hook)')
    .action(() => {
      const input = readStdin();

      const root = resolveContextRoot();
      if (!root) process.exit(0);

      const state = readSleepState(root);
      let dirty = false;

      // Analyze all unanalyzed sessions (score === null)
      for (const session of state.sessions) {
        if (session.score !== null) continue;
        if (!session.transcript_path) {
          session.change_count = 0;
          session.score = 0;
          dirty = true;
          continue;
        }

        const changeCount = analyzeTranscript(session.transcript_path);
        const score = scoreFromChangeCount(changeCount);
        session.change_count = changeCount;
        session.score = score;
        state.debt += score;
        dirty = true;
      }

      if (dirty) {
        writeSleepState(root, state);
      }

      // Generate and output snapshot
      const snapshot = generateSnapshot();
      if (!snapshot) process.exit(0);

      const directive = getConsolidationDirective(state.debt);
      if (directive) {
        console.log(directive);
      }
      console.log(snapshot);
    });

  // --- hook subagent-start ---
  hook
    .command('subagent-start')
    .description('Inject context briefing into sub-agents (called by Claude Code SubagentStart hook)')
    .action(() => {
      const root = resolveContextRoot();
      if (!root) process.exit(0);

      const briefing = generateSubagentBriefing();
      if (!briefing) process.exit(0);

      // SubagentStart hooks must output JSON with hookSpecificOutput.additionalContext
      console.log(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'SubagentStart',
          additionalContext: briefing,
        },
      }));
    });
}
