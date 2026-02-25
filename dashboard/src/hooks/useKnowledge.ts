import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';

export interface KnowledgeEntry {
  slug: string;
  name: string;
  description: string;
  tags: string[];
  date: string;
  pinned: boolean;
  content: string;
}

interface KnowledgeListResponse {
  entries: KnowledgeEntry[];
}

interface KnowledgeResponse {
  entry: KnowledgeEntry;
}

export function useKnowledgeList() {
  return useQuery({
    queryKey: ['knowledge'],
    queryFn: () => api.get<KnowledgeListResponse>('/knowledge'),
    select: (data) => data.entries,
  });
}

export function useKnowledge(slug: string) {
  return useQuery({
    queryKey: ['knowledge', slug],
    queryFn: () => api.get<KnowledgeResponse>(`/knowledge/${slug}`),
    select: (data) => data.entry,
    enabled: !!slug,
  });
}

export function useToggleKnowledgePin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ slug, pinned }: { slug: string; pinned: boolean }) =>
      api.patch<KnowledgeResponse>(`/knowledge/${slug}`, { pinned }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge'] });
    },
  });
}
