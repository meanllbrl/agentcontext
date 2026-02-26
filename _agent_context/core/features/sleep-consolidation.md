---
id: feat_9qLM-gY_
status: active
created: '2026-02-25'
updated: '2026-02-26'
released_version: 0.1.0
tags:
  - architecture
  - backend
  - decisions
related_tasks: []
---

## Why

Agents accumulate knowledge and make decisions across many sessions, but that knowledge degrades or gets lost without a structured consolidation process. Sleep consolidation — modeled on REM sleep — automatically tracks how much work has accumulated and triggers a dedicated sub-agent to fold learnings into the core context files before the brain gets overloaded.

## User Stories

- [x] As an AI agent, I want sleep debt tracked automatically so I don't have to manually decide when to consolidate.
- [x] As an AI agent, I want to see the current sleep debt level at session start so I know whether to consolidate before doing more work.
- [x] As an AI agent, I want graduated awareness thresholds (Alert / Drowsy / Sleepy / Must Sleep) so the urgency of consolidation is unambiguous.
- [x] As an AI agent, I want the Stop hook to record each session's transcript path and last assistant message so the consolidation agent has the raw material it needs.
- [x] As an AI agent, I want the SessionStart hook to auto-analyze any unanalyzed sessions so debt scoring happens even if the Stop hook missed a session.
- [x] As a developer, I want to manually add debt for non-file-change work (architecture discussions, decisions) so the debt meter reflects cognitive load accurately.
- [x] As a developer, I want to reset debt after consolidation with a summary so the system knows when the last sleep happened.
- [x] As an AI agent, I want a dedicated REM Sleep sub-agent to do the consolidation so the main agent can stay focused on the user's task.

## Acceptance Criteria

- `hook stop` reads session_id, transcript_path, and last_assistant_message from stdin JSON; analyzes transcript for Write/Edit tool uses; stores session record in `state/.sleep.json`.
- `hook session-start` finds all sessions with `score: null` and analyzes their transcripts; adds computed scores to debt total.
- Debt scoring: 0 changes = 0, 1-3 changes = +1, 4-8 changes = +2, 9+ changes = +3.
- Debt levels: 0-3 = Alert, 4-6 = Drowsy, 7-9 = Sleepy, 10+ = Must Sleep.
- `hook session-start` prepends a CRITICAL consolidation directive to the snapshot output when debt >= 10.
- `hook session-start` prepends a softer advisory note when debt >= 7.
- `sleep status` shows current debt, level, last sleep date, and per-session history.
- `sleep add <score> <description>` manually records a debt entry (scores 1-3 only).
- `sleep done <summary>` resets debt to 0, records last_sleep date, clears sessions array.
- `sleep debt` outputs the raw debt number for programmatic use.
- If the same session_id stops twice, the old score is subtracted before the new score is added (no double-counting).
- Transcripts over 50MB are skipped (safety cap).

## Constraints & Decisions

- **[2026-02-25]** Debt is tracked in `state/.sleep.json` (dot-prefixed to separate it from user task files in `state/`). The schema: `{ debt: number, last_sleep: string|null, last_sleep_summary: string|null, sessions: SessionRecord[] }`.
- **[2026-02-25]** Transcript analysis is regex-based (`/"name"\s*:\s*"(?:Write|Edit)"/g`), not a full JSON parse, for performance on large JSONL files.
- **[2026-02-25]** The consolidation itself is done by the `agentcontext-rem-sleep` sub-agent, not by the CLI. The CLI only tracks debt; the agent dispatches the sub-agent when needed.
- **[2026-02-25]** Sessions array is LIFO (newest first) — the most recent session is at index 0.

## Technical Details

**Sleep state file**: `_agent_context/state/.sleep.json`

**Schema**:
```json
{
  "debt": 4,
  "last_sleep": "2026-02-24",
  "last_sleep_summary": "Consolidated auth implementation and API design decisions",
  "sessions": [
    {
      "session_id": "abc123",
      "transcript_path": "/path/to/transcript.jsonl",
      "stopped_at": "2026-02-24T18:30:00.000Z",
      "last_assistant_message": "Implemented JWT middleware...",
      "change_count": 7,
      "score": 2
    }
  ]
}
```

**Hook flow**:
1. Session ends → Claude Code fires Stop hook → `hook stop` reads stdin JSON, analyzes transcript, prepends session record to `sessions[]`, adds score to `debt`, writes state.
2. Next session starts → Claude Code fires SessionStart hook → `hook session-start` finds sessions with `score: null`, analyzes their transcripts, updates scores and debt. Then generates and outputs the snapshot with any consolidation directive prepended.

**Scoring function** (`scoreFromChangeCount` in `src/cli/commands/hook.ts`):
- 0 changes → 0 debt
- 1-3 changes → +1 (light session)
- 4-8 changes → +2 (moderate session)
- 9+ changes → +3 (heavy session)

**Key files**:
- `src/cli/commands/hook.ts` — hook stop, hook session-start, transcript analysis, debt scoring
- `src/cli/commands/sleep.ts` — sleep status, sleep add, sleep done, sleep debt, SleepState type, readSleepState/writeSleepState
- `agents/agentcontext-rem-sleep.md` — the REM sleep consolidation sub-agent instructions

**REM Sleep agent protocol**: When dispatched, the agent reads the brief from the main agent, reads session records from `.sleep.json` (using `last_assistant_message` as primary input), determines what files to update, executes updates (soul, user, memory, changelog, task logs, feature PRDs), then calls `agentcontext sleep done "<summary>"` to reset debt.

## Notes

- The Stop hook does not block the session from ending — it has a 5-second timeout. If it fails silently, the SessionStart hook catches up by re-analyzing the transcript.
- The `last_assistant_message` field from the Stop hook is the single most valuable piece of data for the REM sleep agent — it contains Claude's summary of what was accomplished, making transcript reads optional in most cases.
- Manual debt entries (`sleep add`) use a `manual-<timestamp>` session_id and `transcript_path: null`. They will never be re-analyzed by the SessionStart hook.
- The REM sleep agent calls `sleep done` itself after consolidation — the main agent should not call it.

## Changelog
<!-- LIFO: newest entry at top -->

### 2026-02-25 - Created
- Feature PRD created.
