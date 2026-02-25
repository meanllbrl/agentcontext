---
id: task_FmI9fzhk
name: web-dashboard
description: >-
  Build the agentcontext web dashboard. Full feature PRD at
  core/features/web-dashboard.md. Phase 1-4 complete (server, API, React app,
  all pages, error handling, SQL ER diagram preview, field-level change tracking).
  Phase 5 remaining: accessibility audit, responsive layout, i18n token extraction,
  bundle size audit.
priority: critical
status: in_progress
created_at: '2026-02-25'
updated_at: '2026-02-25'
tags:
  - frontend
  - architecture
  - design
parent_task: null
---

## Changelog
<!-- LIFO: newest entry at top -->

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
