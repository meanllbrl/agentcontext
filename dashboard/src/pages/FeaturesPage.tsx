import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { useI18n } from '../context/I18nContext';
import './FeaturesPage.css';

interface Feature {
  slug: string;
  id: string;
  status: string;
  created: string;
  updated: string;
  tags: string[];
  related_tasks: string[];
}

interface FeatureDetail extends Feature {
  content: string;
  sections: string[];
  sectionContents: Record<string, string>;
}

export function FeaturesPage() {
  const { t } = useI18n();
  const [selected, setSelected] = useState<string | null>(null);

  const { data: featuresData, isLoading, isError, error } = useQuery({
    queryKey: ['features'],
    queryFn: () => api.get<{ features: Feature[] }>('/features'),
  });

  const { data: featureDetail } = useQuery({
    queryKey: ['features', selected],
    queryFn: () => api.get<{ feature: FeatureDetail }>(`/features/${selected}`),
    enabled: !!selected,
    select: (data) => data.feature,
  });

  if (isLoading) return <div className="loading">{t('common.loading')}</div>;
  if (isError) return <div className="error-state">Failed to load features. {error?.message}</div>;

  const features = featuresData?.features ?? [];

  return (
    <div className="features-page">
      <h1 className="page-title">{t('features.title')}</h1>

      <div className="features-layout">
        <div className="features-list">
          {features.length === 0 && <div className="core-empty">{t('common.empty')}</div>}
          {features.map(feature => (
            <button
              key={feature.slug}
              className={`feature-card ${selected === feature.slug ? 'feature-card--active' : ''}`}
              onClick={() => setSelected(feature.slug)}
            >
              <div className="feature-card-header">
                <span className="feature-card-name">{feature.slug}</span>
                <span className={`feature-status feature-status--${feature.status}`}>
                  {feature.status}
                </span>
              </div>
              <div className="knowledge-card-tags">
                {feature.tags.map(tag => (
                  <span key={tag} className="task-tag">{tag}</span>
                ))}
              </div>
            </button>
          ))}
        </div>

        <div className="features-detail">
          {!selected && <div className="core-empty">Select a feature to view.</div>}
          {selected && featureDetail && (
            <div className="feature-viewer">
              <h2 className="core-viewer-title">{featureDetail.slug}</h2>
              <div className="feature-meta">
                <span>Status: {featureDetail.status}</span>
                <span>Created: {featureDetail.created}</span>
                <span>Updated: {featureDetail.updated}</span>
              </div>
              {featureDetail.related_tasks.length > 0 && (
                <div className="feature-tasks">
                  Related tasks: {featureDetail.related_tasks.join(', ')}
                </div>
              )}
              {featureDetail.sections.map(section => (
                <div key={section} className="feature-section">
                  <h3 className="feature-section-title">{section}</h3>
                  <pre className="feature-section-content">
                    {featureDetail.sectionContents[section] || '(empty)'}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
