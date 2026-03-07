import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';

export interface Version {
  id: string;
  version: string;
  date: string;
  summary: string;
  status: 'planning' | 'released';
  breaking: boolean;
  features: string[];
  tasks: string[];
}

interface ReleasesResponse {
  entries: Version[];
}

interface ReleaseResponse {
  release: Version;
}

export function useVersions() {
  return useQuery({
    queryKey: ['releases'],
    queryFn: () => api.get<ReleasesResponse>('/releases'),
    select: (data) => data.entries.map(e => ({
      ...e,
      status: e.status ?? 'released',
    })),
  });
}

export function usePlanningVersions() {
  return useQuery({
    queryKey: ['releases'],
    queryFn: () => api.get<ReleasesResponse>('/releases'),
    select: (data) => data.entries
      .map(e => ({ ...e, status: (e.status ?? 'released') as Version['status'] }))
      .filter(e => e.status === 'planning'),
  });
}

export function useCreateVersion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { version: string; summary?: string }) =>
      api.post<ReleaseResponse>('/releases', { ...input, status: 'planning' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['releases'] });
    },
  });
}

export function useUpdateVersion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ version, updates }: { version: string; updates: { status?: string; summary?: string } }) =>
      api.patch<ReleaseResponse>(`/releases/${encodeURIComponent(version)}`, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['releases'] });
    },
  });
}
