import { useState } from 'react';
import { useCreateTask } from '../../hooks/useTasks';
import { useI18n } from '../../context/I18nContext';
import './TaskCreateModal.css';

interface TaskCreateModalProps {
  onClose: () => void;
}

export function TaskCreateModal({ onClose }: TaskCreateModalProps) {
  const { t } = useI18n();
  const createTask = useCreateTask();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [tagsInput, setTagsInput] = useState('');
  const [why, setWhy] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean);

    createTask.mutate(
      { name: name.trim(), description, priority, tags, why: why.trim() || undefined },
      { onSuccess: () => onClose() },
    );
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{t('tasks.create')}</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="modal-body">
          <label className="field">
            <span className="field-label">{t('tasks.name')}</span>
            <input
              className="field-input"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Implement user auth"
              autoFocus
              required
            />
          </label>
          <label className="field">
            <span className="field-label">{t('tasks.description')}</span>
            <textarea
              className="field-textarea"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What needs to be done?"
              rows={3}
            />
          </label>
          <label className="field">
            <span className="field-label">{t('tasks.priority')}</span>
            <select className="field-select" value={priority} onChange={e => setPriority(e.target.value)}>
              <option value="low">{t('priority.low')}</option>
              <option value="medium">{t('priority.medium')}</option>
              <option value="high">{t('priority.high')}</option>
              <option value="critical">{t('priority.critical')}</option>
            </select>
          </label>
          <label className="field">
            <span className="field-label">Why</span>
            <textarea
              className="field-textarea"
              value={why}
              onChange={e => setWhy(e.target.value)}
              placeholder="Why is this task needed?"
              rows={2}
            />
          </label>
          <label className="field">
            <span className="field-label">{t('tasks.tags')}</span>
            <input
              className="field-input"
              value={tagsInput}
              onChange={e => setTagsInput(e.target.value)}
              placeholder="Comma-separated tags"
            />
          </label>
          <div className="modal-actions">
            <button type="button" className="btn btn--ghost" onClick={onClose}>
              {t('tasks.cancel')}
            </button>
            <button type="submit" className="btn btn--primary" disabled={!name.trim() || createTask.isPending}>
              {createTask.isPending ? '...' : t('tasks.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
