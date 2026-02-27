import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from '../api/client';

interface HealthResponse {
  ok: boolean;
  contextRoot: string;
}

interface ProjectContextValue {
  projectId: string;
  contextRoot: string;
  ready: boolean;
}

const ProjectContext = createContext<ProjectContextValue>({
  projectId: '',
  contextRoot: '',
  ready: false,
});

function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
}

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ProjectContextValue>({
    projectId: '',
    contextRoot: '',
    ready: false,
  });

  useEffect(() => {
    api.get<HealthResponse>('/health').then((data) => {
      setState({
        contextRoot: data.contextRoot,
        projectId: hashString(data.contextRoot),
        ready: true,
      });
    }).catch(() => {
      // Fallback: no project scoping
      setState(prev => ({ ...prev, ready: true }));
    });
  }, []);

  return (
    <ProjectContext.Provider value={state}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject(): ProjectContextValue {
  return useContext(ProjectContext);
}
