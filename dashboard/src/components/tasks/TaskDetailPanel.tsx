import { useState } from 'react';
import type { Task } from '../../hooks/useTasks';
import { useUpdateTask, useAddTaskChangelog, useInsertTaskSection } from '../../hooks/useTasks';
import { useI18n } from '../../context/I18nContext';
import './TaskDetailPanel.css';

interface TaskDetailPanelProps {
  task: Task;
  onClose: () => void;
}

const TASK_SECTIONS = [
  { key: 'why', label: 'Why', field: 'why' as const },
  { key: 'user_stories', label: 'User Stories', field: 'user_stories' as const },
  { key: 'acceptance_criteria', label: 'Acceptance Criteria', field: 'acceptance_criteria' as const },
  { key: 'constraints', label: 'Constraints & Decisions', field: 'constraints' as const },
  { key: 'technical_details', label: 'Technical Details', field: 'technical_details' as const },
  { key: 'notes', label: 'Notes', field: 'notes' as const },
] as const;

export function TaskDetailPanel({ task, onClose }: TaskDetailPanelProps) {
  const { t } = useI18n();
  const updateTask = useUpdateTask();
  const addChangelog = useAddTaskChangelog();
  const insertSection = useInsertTaskSection();
  const [changelogEntry, setChangelogEntry] = useState('');
  const [insertInputs, setInsertInputs] = useState<Record<string, string>>({});
  const [mutationError, setMutationError] = useState<string | null>(null);

  const onMutationError = (err: Error) => {
    setMutationError(err.message);
    setTimeout(() => setMutationError(null), 5000);
  };

  const handleStatusChange = (status: string) => {
    updateTask.mutate(
      { slug: task.slug, updates: { status: status as Task['status'] } },
      { onError: onMutationError },
    );
  };

  const handlePriorityChange = (priority: string) => {
    updateTask.mutate(
      { slug: task.slug, updates: { priority: priority as Task['priority'] } },
      { onError: onMutationError },
    );
  };

  const handleAddChangelog = (e: React.FormEvent) => {
    e.preventDefault();
    if (!changelogEntry.trim()) return;
    addChangelog.mutate(
      { slug: task.slug, content: changelogEntry.trim() },
      { onSuccess: () => setChangelogEntry(''), onError: onMutationError },
    );
  };

  const handleInsertSection = (sectionKey: string) => {
    const content = insertInputs[sectionKey]?.trim();
    if (!content) return;
    insertSection.mutate(
      { slug: task.slug, section: sectionKey, content },
      { onSuccess: () => setInsertInputs(prev => ({ ...prev, [sectionKey]: '' })), onError: onMutationError },
    );
  };

  return (
    <div className="detail-overlay" onClick={onClose}>
      <div className="detail-panel" onClick={e => e.stopPropagation()}>
        <div className="detail-header">
          <h2 className="detail-title">{task.name}</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <div className="detail-body">
          {mutationError && (
            <div className="error-state" style={{ marginBottom: 'var(--space-3)' }}>{mutationError}</div>
          )}
          <p className="detail-desc">{task.description || 'No description.'}</p>

          <div className="detail-fields">
            <div className="detail-field">
              <span className="detail-field-label">Status</span>
              <select
                className="field-select"
                value={task.status}
                onChange={e => handleStatusChange(e.target.value)}
              >
                <option value="todo">{t('tasks.todo')}</option>
                <option value="in_progress">{t('tasks.in_progress')}</option>
                <option value="completed">{t('tasks.completed')}</option>
              </select>
            </div>
            <div className="detail-field">
              <span className="detail-field-label">{t('tasks.priority')}</span>
              <select
                className="field-select"
                value={task.priority}
                onChange={e => handlePriorityChange(e.target.value)}
              >
                <option value="low">{t('priority.low')}</option>
                <option value="medium">{t('priority.medium')}</option>
                <option value="high">{t('priority.high')}</option>
                <option value="critical">{t('priority.critical')}</option>
              </select>
            </div>
          </div>

          {task.tags.length > 0 && (
            <div className="detail-tags">
              {task.tags.map(tag => (
                <span key={tag} className="task-tag">{tag}</span>
              ))}
            </div>
          )}

          {task.related_feature && (
            <div className="detail-field">
              <span className="detail-field-label">Related Feature</span>
              <span className="detail-field-value">{task.related_feature}</span>
            </div>
          )}

          {TASK_SECTIONS.map(({ key, label, field }) => {
            const content = task[field];
            const hasContent = content && !content.match(/^\(.*\)$/);
            return (
              <div key={key} className="detail-section">
                <h3 className="detail-section-title">{label}</h3>
                {hasContent ? (
                  <pre className="section-content">{content}</pre>
                ) : (
                  <p className="detail-empty">No content yet.</p>
                )}
                <div className="section-insert">
                  <input
                    className="field-input"
                    value={insertInputs[key] || ''}
                    onChange={e => setInsertInputs(prev => ({ ...prev, [key]: e.target.value }))}
                    placeholder={`Add to ${label}...`}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleInsertSection(key);
                      }
                    }}
                  />
                  <button
                    className="btn btn--small"
                    onClick={() => handleInsertSection(key)}
                    disabled={!insertInputs[key]?.trim() || insertSection.isPending}
                  >
                    {insertSection.isPending ? '...' : 'Add'}
                  </button>
                </div>
              </div>
            );
          })}

          <div className="detail-section">
            <h3 className="detail-section-title">{t('tasks.changelog')}</h3>
            <form onSubmit={handleAddChangelog} className="changelog-add">
              <input
                className="field-input"
                value={changelogEntry}
                onChange={e => setChangelogEntry(e.target.value)}
                placeholder="Add a changelog entry..."
              />
              <button type="submit" className="btn btn--primary" disabled={!changelogEntry.trim() || addChangelog.isPending}>
                {addChangelog.isPending ? '...' : t('tasks.add_entry')}
              </button>
            </form>
            {task.changelog ? (
              <pre className="changelog-content">{task.changelog}</pre>
            ) : (
              <p className="detail-empty">No changelog entries yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
