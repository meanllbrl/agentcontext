import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';

interface SessionRecord {
  session_id: string;
  transcript_path: string | null;
  stopped_at: string | null;
  last_assistant_message: string | null;
  change_count: number | null;
  score: number | null;
}

interface FieldChange {
  field: string;
  from: string | number | boolean | string[] | null;
  to: string | number | boolean | string[] | null;
}

interface DashboardChange {
  timestamp: string;
  entity: string;
  action: string;
  target: string;
  field?: string;
  fields?: FieldChange[];
  summary: string;
}

export interface SleepState {
  debt: number;
  last_sleep: string | null;
  last_sleep_summary: string | null;
  sleep_started_at: string | null;
  sessions: SessionRecord[];
  dashboard_changes: DashboardChange[];
}

export function getSleepLevel(debt: number): string {
  if (debt <= 3) return 'Alert';
  if (debt <= 6) return 'Drowsy';
  if (debt <= 9) return 'Sleepy';
  return 'Must Sleep';
}

export function getSleepLevelKey(debt: number): string {
  if (debt <= 3) return 'alert';
  if (debt <= 6) return 'drowsy';
  if (debt <= 9) return 'sleepy';
  return 'must_sleep';
}

export function useSleep() {
  return useQuery({
    queryKey: ['sleep'],
    queryFn: () => api.get<SleepState>('/sleep'),
  });
}
