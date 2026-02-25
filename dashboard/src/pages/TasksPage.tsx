import { KanbanBoard } from '../components/tasks/KanbanBoard';
import { useI18n } from '../context/I18nContext';

export function TasksPage() {
  const { t } = useI18n();
  return (
    <div>
      <h1 className="page-title">{t('tasks.title')}</h1>
      <KanbanBoard />
    </div>
  );
}
