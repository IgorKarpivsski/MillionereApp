import {
  SessionAnswerSchema,
  SessionPayloadSchema,
  WorldsConfigSchema,
  WorldsStateSchema,
  type SessionAnswer,
  type SessionPayload,
  type WorldConfig,
  type WorldsState,
} from '@fm/shared';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/AuthProvider';
import { rpc } from '@/features/profile/api';
import { queryKeys } from '@/lib/queryClient';
import { supabase } from '@/lib/supabase';
import { fmt, strings } from '@/lib/i18n';

/** Sessions: 10 questions from one world (or a mix). The server decides everything. */
export const sessionApi = {
  start: (world: string, level: number | null): Promise<SessionPayload> =>
    rpc('session_start', { p_world: world, p_level: level }, (x) => SessionPayloadSchema.parse(x)),
  next: (runId: string): Promise<SessionPayload> => rpc('session_next', { p_run: runId }, (x) => SessionPayloadSchema.parse(x)),
  resume: (runId: string): Promise<SessionPayload> => rpc('session_resume', { p_run: runId }, (x) => SessionPayloadSchema.parse(x)),
  answer: (runId: string, rung: number, slot: number): Promise<SessionAnswer> =>
    rpc('session_answer', { p_run: runId, p_rung: rung, p_slot: slot }, (x) => SessionAnswerSchema.parse(x)),
  fifty: (runId: string): Promise<SessionPayload> => rpc('session_5050', { p_run: runId }, (x) => SessionPayloadSchema.parse(x)),
  state: (): Promise<WorldsState> => rpc('worlds_state', undefined, (x) => WorldsStateSchema.parse(x)),
};

/** Fallback so the map renders even before the config arrives. */
export const DEFAULT_WORLDS: WorldConfig[] = [
  { slug: 'geography', name: 'גאוגרפיה', icon: 'globe', color: '#22B07D', levels: 30 },
  { slug: 'history', name: 'היסטוריה', icon: 'scroll', color: '#C9853A', levels: 5 },
  { slug: 'science', name: 'מדע', icon: 'atom', color: '#3E8EF7', levels: 8 },
  { slug: 'nature', name: 'טבע וחיות', icon: 'leaf', color: '#6CBF3B', levels: 20 },
  { slug: 'space', name: 'חלל', icon: 'planet', color: '#7B5CF0', levels: 6 },
  { slug: 'culture', name: 'אמנות וספרות', icon: 'palette', color: '#E2557B', levels: 9 },
  { slug: 'screen', name: 'קולנוע', icon: 'film', color: '#F2694B', levels: 8 },
  { slug: 'music', name: 'מוזיקה', icon: 'note', color: '#D84FD0', levels: 7 },
  { slug: 'people', name: 'אישים', icon: 'person', color: '#F0A020', levels: 10 },
  { slug: 'israel', name: 'ישראל', icon: 'star', color: '#2F7DE1', levels: 12 },
  { slug: 'sport', name: 'ספורט', icon: 'medal', color: '#14A3B8', levels: 9 },
  { slug: 'food', name: 'אוכל', icon: 'food', color: '#EE8A2E', levels: 10 },
  { slug: 'football', name: 'כדורגל', icon: 'ball', color: '#1E9E4A', levels: 25 },
  { slug: 'hanukkah', name: 'חנוכה', icon: 'menorah', color: '#2F6FE0', levels: 6 },
];

export const MIX_WORLD: WorldConfig = { slug: 'mix', name: 'משחק מהיר', icon: 'bolt', color: '#FFB000', levels: 0 };

/** The list of worlds (names, colors, level counts) — public server config, changeable without an update. */
export function useWorldsConfig(): WorldConfig[] {
  const { data } = useQuery({
    queryKey: queryKeys.worldsConfig,
    staleTime: 30 * 60_000,
    queryFn: async () => {
      const { data: row } = await supabase.from('app_config').select('value').eq('key', 'worlds').maybeSingle();
      const parsed = WorldsConfigSchema.safeParse(row?.value);
      return parsed.success ? parsed.data.filter((w) => w.active !== false) : DEFAULT_WORLDS;
    },
  });
  return data ?? DEFAULT_WORLDS;
}

export function worldBySlug(list: WorldConfig[], slug: string | null | undefined): WorldConfig {
  if (slug === 'mix') return MIX_WORLD;
  return list.find((w) => w.slug === slug) ?? DEFAULT_WORLDS.find((w) => w.slug === slug) ?? MIX_WORLD;
}

export function useWorldsState() {
  const { session } = useAuth();
  return useQuery({ queryKey: queryKeys.worlds, queryFn: sessionApi.state, enabled: !!session, staleTime: 30_000 });
}

/** Champion tier size after a world's last level (mirrors public.champion_levels). */
export function championLevels(levels: number): number {
  return levels > 0 ? Math.max(5, Math.ceil(levels / 3)) : 0;
}

/** "שלב 7", or "אלוף 2" for the champion tier. */
export function levelLabel(level: number, levels: number): string {
  return levels > 0 && level > levels ? fmt(strings.champion.levelName, { n: level - levels }) : fmt(strings.worlds.level, { n: level });
}
