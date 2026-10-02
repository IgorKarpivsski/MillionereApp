# ADR 0001 — Architecture for the MVP

Status: accepted (2026-10-02)

## Decision

- **App:** React Native + Expo (Expo Router, TypeScript strict), Hebrew-only, forced RTL.
- **Backend:** Supabase (Postgres, Auth, Storage, Edge Functions).
- **Economy is server-authoritative.** Clients read their own rows (RLS) and call
  granted RPCs. Every balance change goes through `public.ledger_apply`, which
  clients cannot call. Each movement carries an idempotency key; a retry
  returns the original result.
- **Guests are real users** (Supabase anonymous sign-in). Linking Apple/Google
  keeps the same user id, so no progress migration is ever needed.
- **Config over code:** economy values live in `app_config` and config tables;
  `@fm/economy-config` holds defaults for seeding and display only.
- **Prize ladder pays Prize Points (score), not coins.** Coins per run are a
  separate, smaller table, to prevent inflation.

## Why not Unity

The game is mostly UI (lists, albums, shop, settings). React Native gives
native accessibility (VoiceOver, Dynamic Type), smaller builds and faster
iteration; Reanimated + Skia cover the pack-opening and reveal animations.

## Consequences

- SQL is a first-class codebase: migrations only, every RPC tested
  (`supabase/tests`, run by `pnpm test:db` and CI).
- New economy features add RPCs that call `ledger_apply`; nothing else may
  update `wallets`.
