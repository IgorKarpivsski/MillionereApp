# מיליונר הכדורגל (Football Millionaire)

Hebrew football trivia + sticker-collecting game for iOS (Android later).
Working name — see the trademark note in `apps/mobile/app.config.ts`.

Architecture and roadmap: the "Football Millionaire — ארכיטקטורה ותוכנית MVP" doc.
Decisions: `docs/adr/`. Asset licenses: `LICENSES/ASSETS.md`.

## Status: Phase 1 (foundation)

| Area | State |
| --- | --- |
| Monorepo (pnpm + Turborepo), shared packages | Done |
| Supabase schema: profiles, settings, devices, wallets, ledger, config, rate limits, audit | Done, tested |
| RLS + server-only economy (`ledger_apply`), idempotency, rate limiting | Done, tested |
| Auth: guest on first launch, link Apple/Google, sign out, delete account | Done (needs provider keys) |
| App shell: 5 tabs, Hebrew RTL, design system, offline banner, settings, legal placeholders | Done |
| Welcome bonus (first server-side economy flow) | Done, tested |

## Run it

Requirements: Node 20+, pnpm 10, Supabase CLI, Docker (for `supabase start`),
Xcode or an EAS account for iOS builds.

```bash
pnpm install
cd apps/mobile && npx expo install --fix && cd ../..   # align Expo package versions with the SDK

supabase start                       # local Postgres + Auth + API
supabase db reset                    # applies supabase/migrations
cp apps/mobile/.env.example apps/mobile/.env.local   # fill URL + anon key printed by `supabase start`

pnpm --filter @fm/mobile exec eas build --profile development --platform ios   # dev client, once
pnpm dev                             # Metro; open in the dev client
```

The app forces RTL natively (`extra.forcesRTL`). Because of that it needs a
dev client build, not Expo Go.

## Tests

```bash
pnpm test        # economy config, color contrast (WCAG AA), formatting, Hebrew strings
pnpm test:db     # migrations + 4 SQL suites + a 20-way concurrency check
```

`pnpm test:db` runs against any Postgres 15+ you can create databases on
(`DATABASE_URL`, default: local socket). It applies `supabase/local/supabase_shim.sql`
first to mimic Supabase's `auth` schema; set `SHIM=0` when pointing at `supabase start`.

## Auth providers (before testing sign-in)

1. Supabase dashboard → Authentication: enable **Anonymous sign-ins** and **Manual linking**.
2. Apple: Services ID + key in Apple Developer; paste into the Apple provider.
3. Google: OAuth client in Google Cloud; paste into the Google provider.
4. Add `footballmillionaire://auth/callback` to the redirect allow list.
5. Deploy account deletion: `supabase functions deploy delete-account`.

## Rules that keep the economy safe

- Clients never write economy tables. Every change goes through an RPC that
  calls `public.ledger_apply` with an idempotency key.
- Amounts come from server config (`app_config`), never from the client.
- New RPC → new SQL test in `supabase/tests` (including a "client cannot" case).
