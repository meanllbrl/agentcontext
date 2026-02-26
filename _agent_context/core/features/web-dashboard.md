---
id: feat_O7LODr7O
status: active
created: '2026-02-25'
updated: '2026-02-26'
released_version: 0.1.0
tags:
  - frontend
  - architecture
  - design
related_tasks:
  - web-dashboard
---

## Why

Users need a visual interface to manage agent context without using the terminal. The dashboard provides a Kanban task board, sleep state tracking, core file editing, knowledge management, and feature viewing, all through a premium Notion/Linear-inspired web UI. Every manual change is tracked in the sleep file so the agent learns what the user did between sessions.

## User Stories

- [ ] As a user, I want to run `agentcontext dashboard` and have a web UI open in my browser so that I can manage my project context visually
- [ ] As a user, I want to see a Kanban board of my tasks so that I can track work status at a glance
- [ ] As a user, I want to drag tasks between columns (todo, in_progress, completed) so that I can update status without typing commands
- [ ] As a user, I want to filter tasks by status, priority, tags, text search, and date range so that I can find specific tasks quickly
- [ ] As a user, I want to group tasks by status, priority, or see them ungrouped so that I can organize the board to my preference
- [ ] As a user, I want to create new tasks from the dashboard with name, description, priority, and tags so that I can add work without the CLI
- [ ] As a user, I want to update task fields (status, priority, description) and add changelog entries from a detail panel so that I can keep tasks current
- [ ] As a user, I want to see the agent character in the top-left corner showing sleep state (alert, drowsy, sleepy, must sleep) so that I know when consolidation is needed
- [ ] As a user, I want a dedicated sleep page showing debt level, session history, and dashboard changes so that I can track sleep cycles in a beautiful UI
- [ ] As a user, I want to read and edit core files (soul, user, memory, style guide, tech stack) with a markdown editor and live preview so that I can update project identity
- [ ] As a user, I want to browse, search, and view knowledge files so that I can find stored knowledge quickly
- [ ] As a user, I want to pin and unpin knowledge files from the dashboard so that important knowledge appears in the snapshot
- [ ] As a user, I want to view feature PRDs with all their sections (Why, User Stories, Acceptance Criteria, etc.) so that I can review feature specs
- [ ] As a user, I want all manual changes I make in the dashboard to be recorded in the sleep file so that the agent consolidates them during the next sleep cycle
- [ ] As a user, I want light and dark mode (with system preference detection) so that the UI matches my OS settings
- [ ] As a user, I want multi-language support (English initially, i18n-ready) so that the dashboard can be localized in the future

## Acceptance Criteria

### Kanban Board
- [ ] Board shows three columns by default: To Do, In Progress, Completed
- [ ] Tasks can be dragged between columns, status updates on drop
- [ ] Filter by status (todo/in_progress/completed) works
- [ ] Filter by priority (critical/high/medium/low) works
- [ ] Text search filters by task name and description
- [ ] Date range filter (from/to) on created_at or updated_at field works
- [ ] Filter state persists across page reloads via localStorage
- [ ] Clear Filters button resets filter fields but preserves sort and groupBy
- [ ] Filter by tag (text search) works
- [ ] Sort by updated date, created date, priority, name works
- [ ] Group by status (default), priority, or no grouping works
- [ ] Create task modal: name (required), description, priority selector, comma-separated tags
- [ ] Detail panel slides in from right on task click: shows all fields, status/priority dropdowns, changelog with add entry form

### Sleep State
- [ ] Agent avatar (diamond logo) in header: full color when alert, dims progressively, pulses with "zzz" when must_sleep
- [ ] Sleep badge in header shows level name and debt number
- [ ] Sleep page: large debt gauge with color coding (green/yellow/purple/red by level)
- [ ] Sleep page: session history timeline with timestamps, scores, change counts
- [ ] Sleep page: dashboard changes list with entity/action/summary

### Core Files
- [ ] File list in left panel shows all core files (0.soul.md through 5.data_structures.sql, CHANGELOG.json, RELEASES.json)
- [ ] Clicking a file shows content in right panel
- [ ] Markdown files have an Edit button that opens split-pane editor (textarea left, preview right)
- [ ] JSON files display formatted JSON
- [ ] Saving a core file records the change in .sleep.json dashboard_changes

### Knowledge Management
- [ ] Knowledge list shows all knowledge files with name, description, tags
- [ ] Search filters by name, description, and tags
- [ ] Pin/unpin toggle on each knowledge card
- [ ] Clicking shows full content in detail panel
- [ ] Pin/unpin records change in .sleep.json dashboard_changes

### Features
- [ ] Feature list shows all features with slug, status badge, tags
- [ ] Clicking shows full PRD: all sections (Why, User Stories, Acceptance Criteria, Constraints, Technical Details, Notes, Changelog)

### Change Tracking
- [ ] Every create/update action via dashboard API writes to .sleep.json dashboard_changes array
- [ ] Each change records: timestamp, entity, action, target file, field changed, human-readable summary
- [ ] `agentcontext sleep done` clears dashboard_changes along with sessions

### Design
- [ ] Lightweight, minimal UI inspired by Notion and Linear
- [ ] Purple-to-magenta brand gradient: #641787, #781ca3, #8200a6, #db04b4
- [ ] Font: Visby CF with system font fallback
- [ ] 4px grid spacing system
- [ ] HSL/OKLCH color system (no hex in CSS custom properties)
- [ ] Light and dark mode with system preference detection and manual toggle
- [ ] WCAG AA contrast ratios
- [ ] Responsive layout (sidebar collapses on small screens)

### Technical
- [ ] Command: `agentcontext dashboard` starts HTTP server on localhost:4173 (configurable with --port)
- [ ] Server: Node.js native http module, zero new runtime dependencies
- [ ] Frontend: React 19 + Vite 6 + TypeScript strict
- [ ] State: TanStack Query for server data, Context for theme/i18n
- [ ] Build: `npm run build` builds dashboard then CLI, dashboard output copied to dist/dashboard/
- [ ] All existing 258+ tests continue to pass

## Constraints & Decisions
<!-- LIFO: newest decision at top -->

- **[2026-02-25]** Agent character: user will provide custom design later. Using brand diamond logo as placeholder with opacity/animation based on sleep level.
- **[2026-02-25]** Multi-language: i18n infrastructure built (I18nContext with t() function and translation keys), English only for v1. Adding languages means adding translation objects.
- **[2026-02-25]** No router library: 5 pages managed by state-based page switcher. No deep linking needed. Add wouter (~1.5KB) later if URL routing is wanted.
- **[2026-02-25]** No drag-and-drop library: using native HTML DnD API. Upgrade to @dnd-kit if UX is insufficient.
- **[2026-02-25]** No CSS framework: custom CSS with design tokens (CSS custom properties). Keeps bundle minimal, full control over design system.
- **[2026-02-25]** Server uses Node.js native http module: zero new runtime dependencies. Routes are thin wrappers around existing src/lib/ utilities.
- **[2026-02-25]** dashboard_changes separate from sessions: dashboard changes are individual user actions, agent sessions have transcripts and scores. Mixing them would confuse the rem-sleep agent.
- **[2026-02-25]** Dashboard is a separate build target (dashboard/ directory with own package.json). React deps isolated from CLI deps.
- **[2026-02-25]** Framework: React + Vite chosen over Preact/Svelte for full ecosystem support (TanStack Query, rich component patterns).
- **[2026-02-25]** Editor: Markdown textarea with live preview. No heavy editor library for v1.

## Technical Details

### Architecture
- `src/server/` - Node HTTP server + REST API (bundled by tsup with CLI)
- `dashboard/` - React SPA (built by Vite, output copied to dist/dashboard/)
- Server serves static files from dist/dashboard/ and API from /api/*

### Key Files
- `src/server/index.ts` - createServer, startDashboardServer(), route registration
- `src/server/router.ts` - URL pattern matching with :param extraction
- `src/server/routes/*.ts` - API handlers (tasks, sleep, core, knowledge, features, changelog, health)
- `src/server/change-tracker.ts` - recordDashboardChange() writes to .sleep.json
- `src/cli/commands/dashboard.ts` - CLI command registration
- `dashboard/src/App.tsx` - React root with providers (QueryClient, Theme, I18n)
- `dashboard/src/styles/tokens.css` - Design tokens (colors, spacing, typography)
- `dashboard/src/hooks/useTasks.ts` - TanStack Query hooks for task CRUD
- `dashboard/src/components/tasks/KanbanBoard.tsx` - Main board with filtering/sorting/grouping

### API Endpoints
17 endpoints covering: tasks (5), sleep (2), core (3), knowledge (3), features (2), changelog (1), releases (1), health (1). All mutating endpoints call recordDashboardChange().

### Build Pipeline
1. `npm run build:dashboard` - Vite builds React app to dashboard/dist/
2. `npm run build:cli` - tsup builds CLI + server to dist/index.js
3. tsup onSuccess copies dashboard/dist/ to dist/dashboard/
4. dist/dashboard/ ships in npm package (covered by "files": ["dist"])

## Notes

- Bundle size: ~80KB gzipped (React + app). Acceptable for a CLI tool.
- The dashboard reads/writes the same _agent_context/ files as the CLI. No separate database.
- Port 4173 chosen to match Vite preview convention. Configurable with --port flag.
- The server keeps running until Ctrl+C. It does not daemonize.
- Phase 4b complete. Enhanced filters added (status, text search, date range, localStorage persistence). Phase 5 (a11y, responsive, i18n tokens, bundle audit) pending.
- The Visby CF font is commercial. Dashboard uses system font fallback if Visby CF is not installed.

## Changelog
<!-- LIFO: newest entry at top -->


### 2026-02-26 - Update
- SQL parser rewrite + SubagentStart briefing restructure: fixed sql-parser.ts line-by-line parsing, added REFERENCES FK detection and JSONB sub-field collapsible groups in SqlPreview. Restructured SubagentStart briefing with directive at top to prevent sub-agents ignoring context files. 325 tests passing.
### 2026-02-26 - Enhanced Task Filters
- Status filter dropdown, text search (name+description), date range with field selector (created_at/updated_at)
- Filter state persisted via usePersistedState hook (localStorage prefix: agentcontext:)
- Clear Filters button with active-count badge; preserves sortField and groupBy on clear

### 2026-02-26 - UI Polish + Bug Fix
- Fixed selectedTask stale snapshot: selectedSlug string + useMemo derivation from live TanStack Query data
- Animated brand gradient background with subtle-pulse, stagger entrance animations for Kanban columns
- CSS refinements: Header, Sidebar, Shell, KanbanColumn, TaskCard, TaskCreateModal, TaskDetailPanel, TaskFilters, CorePage, FeaturesPage, SleepPage, tokens
- Release discovery UI connected: releases list/show/add from dashboard API

### 2026-02-25 - Phase 4 Polish
- Error handling: ErrorBoundary, res.ok checks, mutation error feedback with auto-dismiss
- Field-level change tracking: FieldChange interface, net-change detection/folding, 19 new tests
- SQL ER diagram: sql-parser.ts, SqlPreview component with SVG bezier relationship lines, File/Preview tab toggle
- Server hardening: 1MB body size limit, graceful shutdown (SIGINT/SIGTERM), 30s socket timeout

### 2026-02-25 - Phase 1-4 Implementation
- Built complete server infrastructure: HTTP server, router, middleware, static file serving, 17 REST API endpoints
- Built change tracking: dashboard_changes array in .sleep.json, recorded on every mutating API call
- Built full React dashboard: Kanban board with drag-and-drop, filtering, sorting, grouping
- Built task CRUD: create modal, detail panel with status/priority editing, changelog entries
- Built sleep page: debt gauge, session history, dashboard changes timeline
- Built core file viewer/editor: file list, markdown split-pane editor with live preview
- Built knowledge page: search, pin/unpin, content viewer
- Built features page: list with status badges, full PRD section viewer
- Built design system: purple-magenta brand tokens, light/dark mode, 4px grid, HSL colors
- Built i18n infrastructure: English translations, t() function, ready for more languages
- Extended SleepState interface with dashboard_changes, updated sleep done to clear it
- Updated build pipeline: build:dashboard + build:cli, tsup copies dashboard output
- All 258 tests passing

### 2026-02-25 - Created
- Feature PRD created.
