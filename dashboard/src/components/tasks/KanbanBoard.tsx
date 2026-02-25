import { useState, useMemo } from 'react';
import type { Task } from '../../hooks/useTasks';
import { useTasks, useUpdateTask } from '../../hooks/useTasks';
import { useI18n } from '../../context/I18nContext';
import { KanbanColumn } from './KanbanColumn';
import { TaskFilters, type SortField, type GroupBy } from './TaskFilters';
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

export function KanbanBoard() {
  const { t } = useI18n();
  const { data: tasks, isLoading, isError, error } = useTasks();
  const updateTask = useUpdateTask();
  const [showCreate, setShowCreate] = useState(false);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [priorityFilter, setPriorityFilter] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [sortField, setSortField] = useState<SortField>('updated_at');
  const [groupBy, setGroupBy] = useState<GroupBy>('status');

  const filtered = useMemo(() => {
    let result = tasks ?? [];
    if (priorityFilter) {
      result = result.filter(t => t.priority === priorityFilter);
    }
    if (tagFilter.trim()) {
      const tag = tagFilter.trim().toLowerCase();
      result = result.filter(t => t.tags.some(tt => tt.toLowerCase().includes(tag)));
    }
    return sortTasks(result, sortField);
  }, [tasks, priorityFilter, tagFilter, sortField]);

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
        priorityFilter={priorityFilter}
        onPriorityFilterChange={setPriorityFilter}
        tagFilter={tagFilter}
        onTagFilterChange={setTagFilter}
        sortField={sortField}
        onSortFieldChange={setSortField}
        groupBy={groupBy}
        onGroupByChange={setGroupBy}
        onCreateClick={() => setShowCreate(true)}
      />

      <div className="kanban-columns">
        {groupBy === 'status' && STATUS_COLUMNS.map(col => {
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
            />
          );
        })}

        {groupBy === 'priority' && PRIORITY_COLUMNS.map(col => {
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
            />
          );
        })}

        {groupBy === 'none' && (
          <KanbanColumn
            title="All Tasks"
            status="all"
            tasks={filtered}
            count={filtered.length}
            colorVar="--color-brand-vivid"
            onTaskClick={(task) => setSelectedSlug(task.slug)}
            onDrop={() => {}}
          />
        )}
      </div>

      {showCreate && <TaskCreateModal onClose={() => setShowCreate(false)} />}
      {selectedTask && <TaskDetailPanel task={selectedTask} onClose={() => setSelectedSlug(null)} />}
    </div>
  );
}
