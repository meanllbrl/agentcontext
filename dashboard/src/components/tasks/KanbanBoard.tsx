import { useState, useMemo, useCallback } from 'react';
import type { Task } from '../../hooks/useTasks';
import { useTasks, useUpdateTask } from '../../hooks/useTasks';
import { usePersistedState } from '../../hooks/usePersistedState';
import { useI18n } from '../../context/I18nContext';
import { KanbanColumn } from './KanbanColumn';
import { TaskFilters, DEFAULT_FILTERS, type FilterState, type FilterPreset, type SortField } from './TaskFilters';
import { TaskCreateModal } from './TaskCreateModal';
import { TaskDetailPanel } from './TaskDetailPanel';
import './KanbanBoard.css';

const PRIORITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

const STATUS_COLUMNS = [
  { status: 'todo', labelKey: 'tasks.todo', colorVar: '--color-status-todo' },
  { status: 'in_progress', labelKey: 'tasks.in_progress', colorVar: '--color-status-in-progress' },
  { status: 'completed', labelKey: 'tasks.completed', colorVar: '--color-status-completed' },
];

const PRIORITY_COLUMNS = [
  { key: 'critical', label: 'Critical', colorVar: '--color-priority-critical' },
  { key: 'high', label: 'High', colorVar: '--color-priority-high' },
  { key: 'medium', label: 'Medium', colorVar: '--color-priority-medium' },
  { key: 'low', label: 'Low', colorVar: '--color-priority-low' },
];

function sortTasks(tasks: Task[], field: SortField): Task[] {
  return [...tasks].sort((a, b) => {
    switch (field) {
      case 'updated_at':
      case 'created_at':
        return b[field].localeCompare(a[field]);
      case 'priority':
        return (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9);
      case 'name':
        return a.name.localeCompare(b.name);
    }
  });
}

function applyFilters(tasks: Task[], filters: FilterState): Task[] {
  let result = tasks;

  if (filters.searchQuery.trim()) {
    const q = filters.searchQuery.trim().toLowerCase();
    result = result.filter(t =>
      t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)
    );
  }

  if (filters.statusFilter) {
    result = result.filter(t => t.status === filters.statusFilter);
  }

  if (filters.priorityFilter) {
    result = result.filter(t => t.priority === filters.priorityFilter);
  }

  if (filters.tagFilter.trim()) {
    const tag = filters.tagFilter.trim().toLowerCase();
    result = result.filter(t => t.tags.some(tt => tt.toLowerCase().includes(tag)));
  }

  if (filters.dateFrom || filters.dateTo) {
    const field = filters.dateField;
    if (filters.dateFrom) {
      result = result.filter(t => t[field].slice(0, 10) >= filters.dateFrom);
    }
    if (filters.dateTo) {
      result = result.filter(t => t[field].slice(0, 10) <= filters.dateTo);
    }
  }

  return sortTasks(result, filters.sortField);
}

export function KanbanBoard() {
  const { t } = useI18n();
  const { data: tasks, isLoading, isError, error } = useTasks();
  const updateTask = useUpdateTask();
  const [showCreate, setShowCreate] = useState(false);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [filters, setFilters] = usePersistedState<FilterState>('kanban-filters', DEFAULT_FILTERS);
  const [presets, setPresets] = usePersistedState<FilterPreset[]>('kanban-presets', []);

  const handleFilterChange = useCallback(<K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, [setFilters]);

  const handleClearFilters = useCallback(() => {
    setFilters(prev => ({
      ...DEFAULT_FILTERS,
      sortField: prev.sortField,
      groupBy: prev.groupBy,
    }));
  }, [setFilters]);

  const handleSavePreset = useCallback((name: string) => {
    const preset: FilterPreset = {
      id: Date.now().toString(36),
      name,
      filters: { ...filters },
    };
    setPresets(prev => [...prev, preset]);
  }, [filters, setPresets]);

  const handleLoadPreset = useCallback((preset: FilterPreset) => {
    setFilters(preset.filters);
  }, [setFilters]);

  const handleDeletePreset = useCallback((id: string) => {
    setPresets(prev => prev.filter(p => p.id !== id));
  }, [setPresets]);

  const filtered = useMemo(() => {
    return applyFilters(tasks ?? [], filters);
  }, [tasks, filters]);

  const selectedTask = useMemo(() => {
    if (!selectedSlug || !tasks) return null;
    return tasks.find(t => t.slug === selectedSlug) ?? null;
  }, [selectedSlug, tasks]);

  const handleDrop = (slug: string, newStatus: string) => {
    updateTask.mutate({ slug, updates: { status: newStatus as Task['status'] } });
  };

  if (isLoading) {
    return <div className="loading">{t('common.loading')}</div>;
  }
  if (isError) {
    return <div className="error-state">Failed to load tasks. {error?.message}</div>;
  }

  return (
    <div className="kanban-board">
      <TaskFilters
        filters={filters}
        onFilterChange={handleFilterChange}
        onClearFilters={handleClearFilters}
        onCreateClick={() => setShowCreate(true)}
        presets={presets}
        onSavePreset={handleSavePreset}
        onLoadPreset={handleLoadPreset}
        onDeletePreset={handleDeletePreset}
      />

      <div className="kanban-columns">
        {filters.groupBy === 'status' && STATUS_COLUMNS.map((col, index) => {
          const colTasks = filtered.filter(t => t.status === col.status);
          return (
            <KanbanColumn
              key={col.status}
              title={t(col.labelKey)}
              status={col.status}
              tasks={colTasks}
              count={colTasks.length}
              colorVar={col.colorVar}
              onTaskClick={(task) => setSelectedSlug(task.slug)}
              onDrop={handleDrop}
              staggerIndex={index + 1}
            />
          );
        })}

        {filters.groupBy === 'priority' && PRIORITY_COLUMNS.map((col, index) => {
          const colTasks = filtered.filter(t => t.priority === col.key);
          return (
            <KanbanColumn
              key={col.key}
              title={col.label}
              status={col.key}
              tasks={colTasks}
              count={colTasks.length}
              colorVar={col.colorVar}
              onTaskClick={(task) => setSelectedSlug(task.slug)}
              onDrop={(slug, newPriority) => {
                updateTask.mutate({ slug, updates: { priority: newPriority as Task['priority'] } });
              }}
              staggerIndex={index + 1}
            />
          );
        })}

        {filters.groupBy === 'none' && (
          <KanbanColumn
            title="All Tasks"
            status="all"
            tasks={filtered}
            count={filtered.length}
            colorVar="--color-brand-vivid"
            onTaskClick={(task) => setSelectedSlug(task.slug)}
            onDrop={() => { }}
          />
        )}
      </div>

      {showCreate && <TaskCreateModal onClose={() => setShowCreate(false)} />}
      {selectedTask && <TaskDetailPanel task={selectedTask} onClose={() => setSelectedSlug(null)} />}
    </div>
  );
}
