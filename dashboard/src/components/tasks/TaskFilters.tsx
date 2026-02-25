import { useI18n } from '../../context/I18nContext';
import './TaskFilters.css';

export type SortField = 'updated_at' | 'created_at' | 'priority' | 'name';
export type GroupBy = 'status' | 'priority' | 'none';

interface TaskFiltersProps {
  priorityFilter: string;
  onPriorityFilterChange: (value: string) => void;
  tagFilter: string;
  onTagFilterChange: (value: string) => void;
  sortField: SortField;
  onSortFieldChange: (value: SortField) => void;
  groupBy: GroupBy;
  onGroupByChange: (value: GroupBy) => void;
  onCreateClick: () => void;
}

export function TaskFilters({
  priorityFilter,
  onPriorityFilterChange,
  tagFilter,
  onTagFilterChange,
  sortField,
  onSortFieldChange,
  groupBy,
  onGroupByChange,
  onCreateClick,
}: TaskFiltersProps) {
  const { t } = useI18n();

  return (
    <div className="task-filters">
      <div className="task-filters-left">
        <select
          className="filter-select"
          value={priorityFilter}
          onChange={e => onPriorityFilterChange(e.target.value)}
        >
          <option value="">All Priorities</option>
          <option value="critical">{t('priority.critical')}</option>
          <option value="high">{t('priority.high')}</option>
          <option value="medium">{t('priority.medium')}</option>
          <option value="low">{t('priority.low')}</option>
        </select>

        <input
          className="filter-input"
          placeholder={t('tasks.filter') + ' by tag...'}
          value={tagFilter}
          onChange={e => onTagFilterChange(e.target.value)}
        />

        <select
          className="filter-select"
          value={sortField}
          onChange={e => onSortFieldChange(e.target.value as SortField)}
        >
          <option value="updated_at">Sort: Updated</option>
          <option value="created_at">Sort: Created</option>
          <option value="priority">Sort: Priority</option>
          <option value="name">Sort: Name</option>
        </select>

        <select
          className="filter-select"
          value={groupBy}
          onChange={e => onGroupByChange(e.target.value as GroupBy)}
        >
          <option value="status">Group: Status</option>
          <option value="priority">Group: Priority</option>
          <option value="none">No Grouping</option>
        </select>
      </div>

      <button className="btn btn--primary" onClick={onCreateClick}>
        + {t('tasks.create')}
      </button>
    </div>
  );
}
