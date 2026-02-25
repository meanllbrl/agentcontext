import { describe, it, expect, vi, beforeEach } from 'vitest';

// We need to test the internals of change-tracker.ts.
// Since applyNetChangeDetection is not exported, we test via recordDashboardChange.
// Mock the sleep state read/write to isolate the logic.

let mockState: Record<string, unknown> = {};

vi.mock('../../src/cli/commands/sleep.js', () => ({
  readSleepState: () => ({ ...mockState }),
  writeSleepState: (_root: string, state: Record<string, unknown>) => {
    mockState = state;
  },
}));

const { recordDashboardChange, buildFieldSummary } = await import(
  '../../src/server/change-tracker.js'
);

describe('buildFieldSummary', () => {
  it('formats single field transition', () => {
    const result = buildFieldSummary('task', 'state/my-task.md', [
      { field: 'priority', from: 'low', to: 'high' },
    ]);
    expect(result).toBe("task 'my-task': priority low -> high");
  });

  it('formats multiple field transitions', () => {
    const result = buildFieldSummary('task', 'state/my-task.md', [
      { field: 'priority', from: 'low', to: 'high' },
      { field: 'status', from: 'todo', to: 'in_progress' },
    ]);
    expect(result).toBe("task 'my-task': priority low -> high, status todo -> in_progress");
  });

  it('formats array values', () => {
    const result = buildFieldSummary('task', 'state/my-task.md', [
      { field: 'tags', from: ['a', 'b'], to: ['a', 'b', 'c'] },
    ]);
    expect(result).toBe("task 'my-task': tags [a, b] -> [a, b, c]");
  });

  it('formats null values', () => {
    const result = buildFieldSummary('task', 'state/my-task.md', [
      { field: 'related_feature', from: null, to: 'auth' },
    ]);
    expect(result).toBe("task 'my-task': related_feature null -> auth");
  });

  it('strips knowledge/ prefix and .md suffix', () => {
    const result = buildFieldSummary('knowledge', 'knowledge/my-doc.md', [
      { field: 'pinned', from: false, to: true },
    ]);
    expect(result).toBe("knowledge 'my-doc': pinned false -> true");
  });

  it('handles sleep target path', () => {
    const result = buildFieldSummary('sleep', 'state/.sleep.json', [
      { field: 'debt', from: 5, to: 8 },
    ]);
    expect(result).toBe("sleep '.sleep.json': debt 5 -> 8");
  });
});

describe('recordDashboardChange — net-change detection', () => {
  beforeEach(() => {
    mockState = { dashboard_changes: [], debt: 0 };
  });

  it('records a basic field-level change', () => {
    recordDashboardChange('/fake', {
      entity: 'task',
      action: 'update',
      target: 'state/t.md',
      fields: [{ field: 'priority', from: 'low', to: 'high' }],
      summary: '',
    });
    const changes = (mockState as Record<string, unknown>).dashboard_changes as Array<Record<string, unknown>>;
    expect(changes).toHaveLength(1);
    expect((changes[0].fields as Array<Record<string, unknown>>)[0]).toMatchObject({
      field: 'priority',
      from: 'low',
      to: 'high',
    });
  });

  it('detects net-zero: A->B then B->A cancels out', () => {
    recordDashboardChange('/fake', {
      entity: 'task',
      action: 'update',
      target: 'state/t.md',
      fields: [{ field: 'priority', from: 'low', to: 'high' }],
      summary: '',
    });
    recordDashboardChange('/fake', {
      entity: 'task',
      action: 'update',
      target: 'state/t.md',
      fields: [{ field: 'priority', from: 'high', to: 'low' }],
      summary: '',
    });
    const changes = (mockState as Record<string, unknown>).dashboard_changes as unknown[];
    expect(changes).toHaveLength(0);
  });

  it('folds cumulative changes: A->B then B->C becomes A->C', () => {
    recordDashboardChange('/fake', {
      entity: 'task',
      action: 'update',
      target: 'state/t.md',
      fields: [{ field: 'priority', from: 'low', to: 'medium' }],
      summary: '',
    });
    recordDashboardChange('/fake', {
      entity: 'task',
      action: 'update',
      target: 'state/t.md',
      fields: [{ field: 'priority', from: 'medium', to: 'high' }],
      summary: '',
    });
    const changes = (mockState as Record<string, unknown>).dashboard_changes as Array<Record<string, unknown>>;
    expect(changes).toHaveLength(1);
    expect((changes[0].fields as Array<Record<string, unknown>>)[0]).toMatchObject({
      field: 'priority',
      from: 'low',
      to: 'high',
    });
  });

  it('keeps changes for different targets separate', () => {
    recordDashboardChange('/fake', {
      entity: 'task',
      action: 'update',
      target: 'state/a.md',
      fields: [{ field: 'priority', from: 'low', to: 'high' }],
      summary: '',
    });
    recordDashboardChange('/fake', {
      entity: 'task',
      action: 'update',
      target: 'state/b.md',
      fields: [{ field: 'priority', from: 'low', to: 'high' }],
      summary: '',
    });
    const changes = (mockState as Record<string, unknown>).dashboard_changes as unknown[];
    expect(changes).toHaveLength(2);
  });

  it('keeps different fields on same target separate', () => {
    recordDashboardChange('/fake', {
      entity: 'task',
      action: 'update',
      target: 'state/t.md',
      fields: [{ field: 'priority', from: 'low', to: 'high' }],
      summary: '',
    });
    recordDashboardChange('/fake', {
      entity: 'task',
      action: 'update',
      target: 'state/t.md',
      fields: [{ field: 'status', from: 'todo', to: 'in_progress' }],
      summary: '',
    });
    const changes = (mockState as Record<string, unknown>).dashboard_changes as unknown[];
    expect(changes).toHaveLength(2);
  });

  it('append-only actions bypass net-change detection', () => {
    recordDashboardChange('/fake', {
      entity: 'task',
      action: 'update',
      target: 'state/t.md',
      field: 'changelog',
      summary: 'Added changelog entry',
    });
    recordDashboardChange('/fake', {
      entity: 'task',
      action: 'update',
      target: 'state/t.md',
      field: 'changelog',
      summary: 'Added another changelog entry',
    });
    const changes = (mockState as Record<string, unknown>).dashboard_changes as unknown[];
    expect(changes).toHaveLength(2);
  });

  it('old-format entries (no fields) bypass net-change detection', () => {
    recordDashboardChange('/fake', {
      entity: 'core',
      action: 'update',
      target: 'core/file.md',
      summary: 'Updated core file',
    });
    recordDashboardChange('/fake', {
      entity: 'core',
      action: 'update',
      target: 'core/file.md',
      summary: 'Updated core file again',
    });
    const changes = (mockState as Record<string, unknown>).dashboard_changes as unknown[];
    expect(changes).toHaveLength(2);
  });

  it('create actions bypass net-change detection', () => {
    recordDashboardChange('/fake', {
      entity: 'task',
      action: 'create',
      target: 'state/t.md',
      summary: 'Created task',
    });
    const changes = (mockState as Record<string, unknown>).dashboard_changes as unknown[];
    expect(changes).toHaveLength(1);
  });

  it('net-zero with array values', () => {
    recordDashboardChange('/fake', {
      entity: 'task',
      action: 'update',
      target: 'state/t.md',
      fields: [{ field: 'tags', from: ['a', 'b'], to: ['a', 'b', 'c'] }],
      summary: '',
    });
    recordDashboardChange('/fake', {
      entity: 'task',
      action: 'update',
      target: 'state/t.md',
      fields: [{ field: 'tags', from: ['a', 'b', 'c'], to: ['a', 'b'] }],
      summary: '',
    });
    const changes = (mockState as Record<string, unknown>).dashboard_changes as unknown[];
    expect(changes).toHaveLength(0);
  });

  it('regenerates summary after cumulative fold', () => {
    recordDashboardChange('/fake', {
      entity: 'task',
      action: 'update',
      target: 'state/my-task.md',
      fields: [{ field: 'priority', from: 'low', to: 'medium' }],
      summary: '',
    });
    recordDashboardChange('/fake', {
      entity: 'task',
      action: 'update',
      target: 'state/my-task.md',
      fields: [{ field: 'priority', from: 'medium', to: 'high' }],
      summary: '',
    });
    const changes = (mockState as Record<string, unknown>).dashboard_changes as Array<Record<string, unknown>>;
    expect(changes[0].summary).toBe("task 'my-task': priority low -> high");
  });

  it('triple fold: A->B->C->D becomes A->D', () => {
    recordDashboardChange('/fake', {
      entity: 'task',
      action: 'update',
      target: 'state/t.md',
      fields: [{ field: 'priority', from: 'low', to: 'medium' }],
      summary: '',
    });
    recordDashboardChange('/fake', {
      entity: 'task',
      action: 'update',
      target: 'state/t.md',
      fields: [{ field: 'priority', from: 'medium', to: 'high' }],
      summary: '',
    });
    recordDashboardChange('/fake', {
      entity: 'task',
      action: 'update',
      target: 'state/t.md',
      fields: [{ field: 'priority', from: 'high', to: 'critical' }],
      summary: '',
    });
    const changes = (mockState as Record<string, unknown>).dashboard_changes as Array<Record<string, unknown>>;
    expect(changes).toHaveLength(1);
    expect((changes[0].fields as Array<Record<string, unknown>>)[0]).toMatchObject({
      field: 'priority',
      from: 'low',
      to: 'critical',
    });
  });

  it('multi-field update in single change entry', () => {
    recordDashboardChange('/fake', {
      entity: 'task',
      action: 'update',
      target: 'state/t.md',
      fields: [
        { field: 'priority', from: 'low', to: 'high' },
        { field: 'status', from: 'todo', to: 'in_progress' },
      ],
      summary: '',
    });
    const changes = (mockState as Record<string, unknown>).dashboard_changes as Array<Record<string, unknown>>;
    expect(changes).toHaveLength(1);
    expect((changes[0].fields as unknown[]).length).toBe(2);
  });

  it('partial net-zero: multi-field where one cancels', () => {
    // First: priority low->high AND status todo->in_progress
    recordDashboardChange('/fake', {
      entity: 'task',
      action: 'update',
      target: 'state/t.md',
      fields: [
        { field: 'priority', from: 'low', to: 'high' },
        { field: 'status', from: 'todo', to: 'in_progress' },
      ],
      summary: '',
    });
    // Then: revert priority only (high->low)
    recordDashboardChange('/fake', {
      entity: 'task',
      action: 'update',
      target: 'state/t.md',
      fields: [{ field: 'priority', from: 'high', to: 'low' }],
      summary: '',
    });
    const changes = (mockState as Record<string, unknown>).dashboard_changes as Array<Record<string, unknown>>;
    // Priority cancelled, only status remains in the original entry
    expect(changes).toHaveLength(1);
    const fields = changes[0].fields as Array<Record<string, unknown>>;
    expect(fields).toHaveLength(1);
    expect(fields[0].field).toBe('status');
  });
});
