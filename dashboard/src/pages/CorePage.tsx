import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { useI18n } from '../context/I18nContext';
import { SqlPreview } from '../components/core/SqlPreview';
import './CorePage.css';

interface CoreFile {
  filename: string;
  name: string;
  type: string;
}

interface CoreFileDetail {
  filename: string;
  type: string;
  frontmatter?: Record<string, unknown>;
  content?: string;
  sections?: string[];
  sectionContents?: Record<string, string>;
  data?: unknown;
}

export function CorePage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const [editContent, setEditContent] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [viewTab, setViewTab] = useState<'file' | 'preview'>('preview');

  const { data: filesData, isLoading, isError, error } = useQuery({
    queryKey: ['core'],
    queryFn: () => api.get<{ files: CoreFile[] }>('/core'),
  });

  const { data: fileDetail } = useQuery({
    queryKey: ['core', selected],
    queryFn: () => api.get<CoreFileDetail>(`/core/${selected}`),
    enabled: !!selected,
  });

  const saveFile = useMutation({
    mutationFn: ({ filename, content }: { filename: string; content: string }) =>
      api.put(`/core/${filename}`, { content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['core'] });
      setIsEditing(false);
    },
  });

  const handleEdit = () => {
    if (fileDetail?.content !== undefined) {
      setEditContent(fileDetail.content);
      setIsEditing(true);
    }
  };

  const handleSave = () => {
    if (selected && editContent !== null) {
      saveFile.mutate({ filename: selected, content: editContent });
    }
  };

  if (isLoading) return <div className="loading">{t('common.loading')}</div>;
  if (isError) return <div className="error-state">Failed to load core files. {error?.message}</div>;

  const files = filesData?.files ?? [];

  return (
    <div className="core-page">
      <h1 className="page-title">{t('core.title')}</h1>
      <div className="core-layout">
        <div className="core-list">
          {files.map(file => (
            <button
              key={file.filename}
              className={`core-list-item ${selected === file.filename ? 'core-list-item--active' : ''}`}
              onClick={() => { setSelected(file.filename); setIsEditing(false); setViewTab('preview'); }}
            >
              <span className="core-list-name">{file.name}</span>
              <span className="core-list-type">{file.type}</span>
            </button>
          ))}
        </div>

        <div className="core-detail">
          {!selected && (
            <div className="core-empty">Select a file to view.</div>
          )}
          {selected && fileDetail && !isEditing && (
            <div className="core-viewer">
              <div className="core-viewer-header">
                <h2 className="core-viewer-title">{fileDetail.filename}</h2>
                <div className="core-viewer-actions">
                  {selected.endsWith('.sql') && (
                    <div className="core-tabs">
                      <button
                        className={`core-tab ${viewTab === 'file' ? 'core-tab--active' : ''}`}
                        onClick={() => setViewTab('file')}
                      >
                        File
                      </button>
                      <button
                        className={`core-tab ${viewTab === 'preview' ? 'core-tab--active' : ''}`}
                        onClick={() => setViewTab('preview')}
                      >
                        Preview
                      </button>
                    </div>
                  )}
                  {fileDetail.type === 'markdown' && (
                    <button className="btn btn--ghost" onClick={handleEdit}>Edit</button>
                  )}
                </div>
              </div>
              {selected.endsWith('.sql') && viewTab === 'preview' && fileDetail.content ? (
                <SqlPreview content={fileDetail.content} />
              ) : (
                <pre className="core-viewer-content">
                  {fileDetail.content ?? JSON.stringify(fileDetail.data, null, 2)}
                </pre>
              )}
            </div>
          )}
          {selected && isEditing && (
            <div className="core-editor">
              <div className="core-editor-header">
                <h2 className="core-viewer-title">Editing: {selected}</h2>
                <div className="core-editor-actions">
                  <button className="btn btn--ghost" onClick={() => setIsEditing(false)}>Cancel</button>
                  <button className="btn btn--primary" onClick={handleSave} disabled={saveFile.isPending}>
                    {saveFile.isPending ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
              <div className="core-editor-split">
                <textarea
                  className="core-editor-textarea"
                  value={editContent ?? ''}
                  onChange={e => setEditContent(e.target.value)}
                />
                <pre className="core-editor-preview">{editContent}</pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
