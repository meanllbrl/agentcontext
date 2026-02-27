---
id: task_FmI9fzhk
name: web-dashboard
description: >-
  Build the agentcontext web dashboard. Full feature PRD at
  core/features/web-dashboard.md. Phase 1-4 complete (server, API, React app,
  all pages, error handling, SQL ER diagram preview, field-level change
  tracking, UI polish, TaskDetailPanel Notion-style redesign with marked body
  rendering). Phase 5 remaining: accessibility audit, responsive layout, i18n
  token extraction, bundle audit. 336 tests passing.
priority: critical
status: in_progress
created_at: '2026-02-25'
updated_at: '2026-02-27'
tags:
  - frontend
  - architecture
  - design
parent_task: null
---

## Changelog
<!-- LIFO: newest entry at top -->


### 2026-02-27 - Session Update
- SubagentStart hook root cause analysis + fix: directive strengthened (IMPORTANT -> MANDATORY), named tools (Glob, Grep), actionable decision rule added. SKILL.md Context Propagation paragraph replaced: now tells main agent to match task keywords against feature names/tags and include _agent_context/ paths in Explore/Plan prompts. 386 tests passing. Installed globally.
### 2026-02-27 - Notion-Style TaskDetailPanel + Tool Count Scoring
- TaskDetailPanel: properties block (Notion bordered card, 140px label/1fr value grid) + markdown body via marked@^15
- Panel widened 520px → 680px; ExpandableText (3-line clamp, requestAnimationFrame scroll height detection)
- `body: string` added to TaskData (src/server/routes/tasks.ts) + Task interface (useTasks.ts); backward compat maintained
- Removed: TASK_SECTIONS array, per-section <pre> blocks, all section insert inputs, useInsertTaskSection import
- Tool count debt scoring: scoreFromToolCount() in hook.ts, Math.max over scoreFromChangeCount; SessionRecord.tool_count field
- 336 tests passing

### 2026-02-26 - Session Update
- SQL parser rewrite (line-by-line parsing, REFERENCES FK detection, JSONB sub-field parsing, isSqlType validation). SqlPreview collapsible JSONB groups with toggle arrows and count badges. SubagentStart briefing restructured: directive at top, features section promoted with direct Read paths, compact context directory reference. 3 integration tests updated. 325 tests passing.
### 2026-02-26 - Enhanced Task Filters + localStorage Persistence
- Added status filter dropdown to Kanban filters
- Added text search input (searches task name + description)
- Added date range filter with field selector (created_at or updated_at)
- All filter state persisted to localStorage via new usePersistedState hook (prefix: agentcontext:)
- Clear Filters button shows active-count badge; clears filters but preserves sortField and groupBy
- FilterState interface and DEFAULT_FILTERS exported from TaskFilters.tsx for type safety

### 2026-02-26 - UI Polish + Bug Fix + Release Discovery
- Fixed selectedTask stale snapshot bug: now stores selectedSlug + derives task via useMemo from live query data
- CSS polish: animated radial brand gradient background (subtle-pulse 20s), stagger entrance animations for Kanban columns (slide-up-fade with spring curve)
- Refined CSS across all components: Header, Sidebar, TaskCard, TaskCreateModal, TaskDetailPanel, CorePage, FeaturesPage, SleepPage, tokens
- Release discovery system shipped: releases add --yes, releases list, releases show, 3 new API routes, back-populates features
- README and DEEP-DIVE fully updated with Dashboard section and release commands
- 325 tests passing

### 2026-02-25 - Phase 4 Polish Complete
- Error boundaries, loading states, res.ok checks in API client (274 tests)
- Field-level change tracking: FieldChange interface, net-change detection (A->B->A cancelled, A->B->C folded), 19 new unit tests
- SQL ER diagram preview: sql-parser.ts, SqlPreview.tsx/css, File/Preview tab toggle in CorePage
- SubagentStart briefing enriched: features listing, extended core index, knowledge index, priority instructions (301 tests)
- sleep start/done epoch-based clearing, tasks create non-interactive (279 tests)
- Interactive mode highlight styling fixed (purple background fill on focused items)
- 313 tests passing; remaining: Phase 5 (a11y, responsive, i18n tokens, bundle audit)

### 2026-02-25 - Phase 1-4 Complete
- Server: Node HTTP server with 17 REST API endpoints (tasks, sleep, core, knowledge, features, changelog, releases, health)
- Change tracking: dashboard_changes in .sleep.json, cleared on sleep done
- React dashboard: Kanban board (drag-drop, filter, sort, group), task CRUD, sleep page, core editor, knowledge manager, features viewer
- Design: purple-magenta brand tokens, light/dark mode, 4px grid, i18n-ready
- Build pipeline: build:dashboard + build:cli, 258 tests passing

### 2026-02-25 - Created
- Task created.
