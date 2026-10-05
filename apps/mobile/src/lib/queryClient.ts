import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 2,
      networkMode: 'offlineFirst',
    },
    mutations: {
      // Economy mutations are idempotent server-side, but never auto-retry them
      // from the client: the user should see the outcome before trying again.
      retry: 0,
      networkMode: 'online',
    },
  },
});

export const queryKeys = {
  myState: ['my-state'] as const,
  daily: ['daily-status'] as const,
  leaderboard: ['leaderboard-week'] as const,
  collection: ['collection'] as const,
  store: ['store'] as const,
  energy: ['energy'] as const,
  wheel: ['wheel'] as const,
  deals: ['deals'] as const,
  pass: ['pass'] as const,
  friends: ['friends'] as const,
  chat: (id: string) => ['chat', id] as const,
  dupes: (id: string) => ['dupes', id] as const,
};
