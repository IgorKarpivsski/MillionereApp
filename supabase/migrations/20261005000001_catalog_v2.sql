-- =============================================================================
-- Migration 0011 — Catalogue v2: object albums (stadiums, shirts, balls,
-- fictional clubs, merch) next to the legends, and the ultra-rare "מיתי" tier
-- (rarity 'iconic') in every album.
-- =============================================================================
alter table public.albums add column kind text not null default 'players';
alter table public.collectibles add column kind text not null default 'player';
alter table public.collectibles drop constraint collectibles_pos;
alter table public.collectibles add constraint collectibles_pos check (position in ('GK', 'DEF', 'MID', 'FWD', 'OBJ'));
alter table public.collectibles add constraint collectibles_kind check (kind in ('player', 'object'));

-- Odds: the iconic tier becomes truly hard to get, and appears (rarely) in more packs.
update public.app_config set value = '[
  {"slug":"bronze","items":3,"coins":500,"gems":null,"odds":{"common":70,"uncommon":24,"rare":5.8,"iconic":0.2},"guaranteed":null},
  {"slug":"silver","items":4,"coins":1500,"gems":null,"odds":{"common":45,"uncommon":37.6,"rare":14,"epic":3,"iconic":0.4},"guaranteed":null},
  {"slug":"gold","items":5,"coins":4000,"gems":null,"odds":{"uncommon":40,"rare":39.3,"epic":17,"legendary":3,"iconic":0.7},"guaranteed":"rare"},
  {"slug":"epic","items":5,"coins":null,"gems":60,"odds":{"rare":55,"epic":38,"legendary":6,"iconic":1},"guaranteed":"epic"},
  {"slug":"legendary","items":5,"coins":null,"gems":null,"odds":{"epic":60,"legendary":37,"iconic":3},"guaranteed":"legendary"}
]'::jsonb, updated_at = now() where key = 'packs.catalog';
