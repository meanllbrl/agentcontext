import { useSleep, getSleepLevel, getSleepLevelKey } from '../hooks/useSleep';
import { useI18n } from '../context/I18nContext';
import './SleepPage.css';

export function SleepPage() {
  const { t } = useI18n();
  const { data: sleep, isLoading, isError, error } = useSleep();

  if (isLoading || !sleep) {
    return <div className="loading">{t('common.loading')}</div>;
  }
  if (isError) {
    return <div className="error-state">Failed to load sleep state. {error?.message}</div>;
  }

  const level = getSleepLevel(sleep.debt);
  const levelKey = getSleepLevelKey(sleep.debt);

  return (
    <div className="sleep-page">
      <h1 className="page-title">{t('sleep.title')}</h1>

      <div className="sleep-overview">
        <div className={`sleep-gauge sleep-gauge--${levelKey}`}>
          <span className="sleep-gauge-number">{sleep.debt}</span>
          <span className="sleep-gauge-label">{level}</span>
        </div>

        <div className="sleep-details">
          <div className="sleep-detail">
            <span className="sleep-detail-label">{t('sleep.last_sleep')}</span>
            <span className="sleep-detail-value">{sleep.last_sleep ?? 'Never'}</span>
          </div>
          {sleep.last_sleep_summary && (
            <div className="sleep-detail">
              <span className="sleep-detail-label">Summary</span>
              <span className="sleep-detail-value sleep-detail-value--summary">
                {sleep.last_sleep_summary.slice(0, 200)}
              </span>
            </div>
          )}
        </div>
      </div>

      {sleep.sessions.length > 0 && (
        <div className="sleep-section">
          <h2 className="sleep-section-title">{t('sleep.sessions')} ({sleep.sessions.length})</h2>
          <div className="session-list">
            {sleep.sessions.map((session, i) => (
              <div key={i} className="session-item">
                <div className="session-header">
                  <span className="session-time">{session.stopped_at ?? 'Active'}</span>
                  {session.score !== null && (
                    <span className="session-score">+{session.score}</span>
                  )}
                  {session.change_count !== null && (
                    <span className="session-changes">{session.change_count} changes</span>
                  )}
                  {session.tool_count != null && (
                    <span className="session-changes">{session.tool_count} tools</span>
                  )}
                </div>
                {session.last_assistant_message && (
                  <p className="session-message">
                    {session.last_assistant_message.slice(0, 150)}
                    {session.last_assistant_message.length > 150 ? '...' : ''}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {sleep.dashboard_changes.length > 0 && (
        <div className="sleep-section">
          <h2 className="sleep-section-title">Dashboard Changes ({sleep.dashboard_changes.length})</h2>
          <div className="session-list">
            {sleep.dashboard_changes.map((change, i) => (
              <div key={i} className="session-item">
                <div className="session-header">
                  <span className="session-time">{change.timestamp}</span>
                  <span className="session-changes">{change.entity} / {change.action}</span>
                </div>
                <p className="session-message">{change.summary}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
