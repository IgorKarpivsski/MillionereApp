"""Players, clubs, stadiums and awards (Wikidata)."""
from __future__ import annotations

import collections
import random
import re

from qcore import Q, Names, club_ref, fame_obscurity, load, national_display, normalize_he, numeric_distractors, pick_distractors, year_of

FOOTBALL_OCC = {"Q937857", "Q628099", "Q1209498", "Q3427922", "Q18515558", "Q11774891", "Q20738420", "Q55187"}
RESERVE_EN = re.compile(r"\b(B|C|II|III|U-?\d+|under-\d+|youth|reserves?|academy|juniors?|women|ladies|féminin|primavera|castilla|atlètic|jong|amateurs?|olympic)\b", re.I)
RESERVE_HE = re.compile(r"(\sב'$|\sג'$|נוער|עד גיל|נשים|אולימפית|קבוצת המילואים|בוגרים)")

POS_GROUP = {
    "שוער": "שוער",
    "מגן": "מגן", "בלם": "מגן", "מגן אחורי": "מגן", "בלם אחורי": "מגן", "ליברו": "מגן",
    "מגן ימני": "מגן", "מגן שמאלי": "מגן", "בלם מרכזי": "מגן",
    "קשר": "קשר", "קשר התקפי": "קשר", "קשר הגנתי": "קשר", "קשר מרכזי": "קשר",
    "חלוץ": "חלוץ", "חלוץ מרכזי": "חלוץ", "חלוץ אגף": "חלוץ",
}
POSITIONS = ["שוער", "מגן", "קשר", "חלוץ"]
ISRAEL = "Q801"


def base_name(he: str) -> str:
    return normalize_he(RESERVE_HE.sub("", he))


def build(names: Names, rng: random.Random) -> tuple[list[Q], dict]:
    stats = collections.Counter()
    out: list[Q] = []

    famous = {r["p"]: int(r["sl"]) for r in load("players_famous")}
    israeli = {r["p"]: int(r["sl"]) for r in load("players_israeli")}
    occ = collections.defaultdict(set)
    for r in load("player_occupations"):
        occ[r["p"]].add(r["occ"])

    # --- choose players -----------------------------------------------------
    players: dict[str, dict] = {}
    for pid in set(famous) | set(israeli):
        ent = names.get(pid)
        if not ent:
            stats["player_no_hewiki"] += 1
            continue
        other = occ[pid] - FOOTBALL_OCC
        if other and ent.sitelinks >= 40:
            stats["player_famous_for_other"] += 1
            continue
        players[pid] = {"ent": ent, "israeli": pid in israeli, "clubs": {}, "nts": set(), "all_bases": set(), "nt_bases": set()}

    # Names must be unambiguous.
    cnt = collections.Counter(normalize_he(p["ent"].he) for p in players.values())
    for pid in [k for k, p in players.items() if cnt[normalize_he(p["ent"].he)] > 1]:
        del players[pid]
        stats["player_ambiguous_name"] += 1

    # --- careers ---------------------------------------------------------------
    for r in load("player_teams"):
        p = players.get(r["p"])
        if not p:
            continue
        team = names.e.get(r["team"])
        he = team.he if team and team.he else (r.get("teamHe") or "")
        if he:
            p["all_bases"].add(base_name(he))
        if r.get("isNational") == "true":
            if team and team.he_title and not RESERVE_EN.search(team.en_title or "") and not RESERVE_HE.search(team.he_title):
                p["nts"].add(r["team"])
            if team and team.he_title:
                p["nt_bases"].add(normalize_he(national_display(team.he_title)))
            continue
        if not team or not team.he or RESERVE_EN.search(team.en_title or "") or RESERVE_HE.search(team.he_title or ""):
            continue
        c = p["clubs"].setdefault(r["team"], {"referenced": False, "start": None})
        c["referenced"] |= r.get("referenced") == "true"
        y = year_of(r.get("start"))
        if y and (c["start"] is None or y < c["start"]):
            c["start"] = y

    refs = collections.defaultdict(set)      # (entity, prop) -> referenced values
    female = set()
    for r in load("refs_people"):
        if r["referenced"] == "true":
            refs[(r["p"], r["prop"])].add(r["value"])
        if r["prop"] == "gender" and r["value"] in ("Q6581072", "Q1052281"):
            female.add(r["p"])
    for r in load("refs_clubs"):
        if r["referenced"] == "true":
            refs[(r["c"], r["prop"])].add(r["value"])
    facts = {r["p"]: r for r in load("player_facts")}
    births = {}
    positions = collections.defaultdict(set)
    for r in load("player_facts"):
        # Birth year only when Wikidata cites a source for that date.
        if r.get("birth") and any(year_of(v) == year_of(r["birth"]) for v in refs[(r["p"], "birth")]):
            births[r["p"]] = year_of(r["birth"])
        if r.get("posHe"):
            positions[r["p"]].add(r["posHe"])

    # --- clubs ---------------------------------------------------------------
    club_country: dict[str, str] = {}
    club_info: dict[str, dict] = collections.defaultdict(lambda: {"venues": set(), "cities": set(), "inception": set(), "venue_city": {}})
    for r in load("club_facts"):
        c = club_info[r["c"]]
        if r.get("country"):
            club_country[r["c"]] = r["country"]
        if r.get("venue"):
            c["venues"].add(r["venue"])
            if r.get("venueCity"):
                c["venue_city"][r["venue"]] = r["venueCity"]
        if r.get("city"):
            c["cities"].add(r["city"])
        y = year_of(r.get("inception"))
        if y:
            c["inception"].add(y)
    for p in players.values():
        for cq in p["clubs"]:
            club_country.setdefault(cq, None)

    clubs_by_country = collections.defaultdict(list)
    for cq, country in club_country.items():
        ent = names.get(cq)
        if ent and country and not RESERVE_EN.search(ent.en_title or "") and not RESERVE_HE.search(ent.he_title or ""):
            clubs_by_country[country].append(cq)

    # =========================================================================
    # Player questions
    # =========================================================================
    popular_nts = sorted({q for p in players.values() for q in p["nts"]}, key=lambda q: -names.e[q].sitelinks)[:80]
    for pid, p in players.items():
        ent = p["ent"]
        is_isr = p["israeli"]
        fem = pid in female
        played, born, rep = ("שיחקה", "נולדה", "ייצגה") if fem else ("שיחק", "נולד", "ייצג")
        # Israeli players are well known to an Israeli audience at far fewer Wikipedia languages.
        fame = fame_obscurity(ent.sitelinks, 35, 3) if is_isr else fame_obscurity(ent.sitelinks, 160, 8)
        src = [u for u in (ent.he_url, ent.wd_url) if u]
        tags = {"player": pid, "country": "israel" if is_isr else None}

        # National team (only if exactly one senior national team)
        if len(p["nts"]) == 1 and not is_isr:
            nt = next(iter(p["nts"]))
            nt_name = national_display(names.e[nt].he_title)
            pool = [national_display(names.e[q].he_title) for q in popular_nts]
            pool = [x for x in pool if normalize_he(x) not in p["nt_bases"]]
            wrong = pick_distractors(rng, pool, {nt_name})
            if wrong and "נבחרת" not in nt_name:
                out.append(Q(f"את איזו נבחרת {rep} {ent.he}?", nt_name, wrong,
                             f"{ent.he} {played} בנבחרת {nt_name}.", "israeli_football" if is_isr else "players", "players",
                             "player:national_team", 0.05 + 0.75 * fame, src, tags, key=f"pnt:{pid}"))
                stats["player:national_team"] += 1

        # Clubs he played for (referenced career entries only)
        # Answer clubs need a cited AND dated career entry (undated entries are often junk).
        ref_clubs = [c for c, v in p["clubs"].items() if v["referenced"] and v["start"] and names.get(c)]
        ref_clubs.sort(key=lambda c: -names.e[c].sitelinks)
        for cq in ref_clubs[:2]:
            cname = names.he(cq)
            country = club_country.get(cq)
            pool = [names.he(x) for x in clubs_by_country.get(country, []) if x not in p["clubs"]]
            pool = [x for x in pool if x and base_name(x) not in p["all_bases"]]
            pool.sort(key=lambda x: 0)
            wrong = pick_distractors(rng, pool, {cname})
            if not wrong:
                continue
            out.append(Q(f"באיזו מהקבוצות הבאות {played} {ent.he}?", cname, wrong,
                         f"{ent.he} {played} ב{cname}.", "israeli_football" if is_isr else "players", "players",
                         "player:club", 0.15 + 0.6 * fame + 0.2 * fame_obscurity(names.e[cq].sitelinks, 120, 10),
                         src, tags, key=f"pclub:{pid}:{cq}"))
            stats["player:club"] += 1

        # Birth year
        by = births.get(pid)
        if by and 1880 < by < 2012:
            wrong = numeric_distractors(rng, by, [-5, -3, -2, -1, 1, 2, 3, 4])
            out.append(Q(f"באיזו שנה {born} {ent.he}?", str(by), wrong, f"{ent.he} {born} ב-{by}.",
                         "israeli_football" if is_isr else "players", "players", "player:birth_year",
                         0.4 + 0.6 * fame, src, tags, key=f"pby:{pid}"))
            stats["player:birth_year"] += 1

        # Position (only when every listed position maps to one group)
        groups = {POS_GROUP.get(x) for x in positions.get(pid, set())}
        if len(groups) == 1 and None not in groups:
            g = next(iter(groups))
            wrong = [x for x in POSITIONS if x != g]
            out.append(Q(f"באיזו עמדה {played} {ent.he}?", g, wrong, f"{ent.he} {played} בעמדת {g}.",
                         "israeli_football" if is_isr else "players", "players", "player:position",
                         0.15 + 0.7 * fame, src, tags, key=f"ppos:{pid}"))
            stats["player:position"] += 1

    # Reverse: which of these players played for CLUB?
    by_club = collections.defaultdict(list)
    for pid, p in players.items():
        for cq, v in p["clubs"].items():
            if v["referenced"] and v["start"]:
                by_club[cq].append(pid)
    for cq, pids in by_club.items():
        cname = names.he(cq)
        if not cname or len(pids) < 3:
            continue
        pids.sort(key=lambda x: -players[x]["ent"].sitelinks)
        for pid in pids[:6]:
            p = players[pid]
            by = births.get(pid) or 1980
            nt = next(iter(p["nts"]), None)
            pool = [q for q, o in players.items() if cq not in o["clubs"] and base_name(cname) not in o["all_bases"]
                    and abs((births.get(q) or 0) - by) <= 7 and (nt is None or nt in o["nts"])
                    and ((q in female) == (pid in female))]
            pool.sort(key=lambda q: -players[q]["ent"].sitelinks)
            wrong = pick_distractors(rng, [players[q]["ent"].he for q in pool[:30]], {p["ent"].he})
            if not wrong:
                continue
            is_isr = club_country.get(cq) == ISRAEL
            pf = fame_obscurity(p["ent"].sitelinks, 35, 3) if p["israeli"] else fame_obscurity(p["ent"].sitelinks, 160, 8)
            cf = fame_obscurity(names.e[cq].sitelinks, 40, 4) if is_isr else fame_obscurity(names.e[cq].sitelinks, 120, 8)
            fem = pid in female
            out.append(Q(f"{'איזו מהשחקניות הבאות שיחקה' if fem else 'איזה מהשחקנים הבאים שיחק'} ב{club_ref(names.e[cq])}?", p["ent"].he, wrong,
                         f"{p['ent'].he} {'שיחקה' if fem else 'שיחק'} ב{cname}.", "israeli_football" if is_isr else "clubs", "clubs",
                         "club:which_player", 0.2 + 0.45 * pf + 0.3 * cf,
                         [u for u in (names.e[cq].he_url, p["ent"].he_url) if u], {"club": cq},
                         key=f"cwp:{cq}:{pid}"))
            stats["club:which_player"] += 1

    # =========================================================================
    # Club and stadium questions
    # =========================================================================
    club_ids = {r["c"] for r in load("clubs_top")} | {r["c"] for r in load("clubs_israeli")}
    for cq in club_ids:
        ent = names.get(cq)
        info = club_info.get(cq)
        if not ent or not info or RESERVE_EN.search(ent.en_title or "") or RESERVE_HE.search(ent.he_title or ""):
            continue
        country = club_country.get(cq)
        is_isr = country == ISRAEL
        cat = "israeli_football" if is_isr else "clubs"
        fame = fame_obscurity(ent.sitelinks, 40, 4) if is_isr else fame_obscurity(ent.sitelinks, 120, 8)
        src = [u for u in (ent.he_url, ent.wd_url) if u]
        well_known = ent.sitelinks >= 50 and not is_isr
        cited_years = {year_of(v) for v in refs[(cq, "inception")]}
        if len(info["inception"]) == 1 and (well_known or next(iter(info["inception"])) in cited_years):
            y = next(iter(info["inception"]))
            if 1850 < y < 2025:
                wrong = numeric_distractors(rng, y, [-15, -9, -5, -3, 3, 5, 9, 14], hi=2024)
                ref = club_ref(ent)
                out.append(Q(f"באיזו שנה {'נוסד' if ref.startswith('מועדון') else 'נוסדה'} {ref}?", str(y), wrong, f"{ent.he} נוסדה ב-{y}.", cat, "history",
                             "club:founded", 0.5 + 0.5 * fame, src, {"club": cq}, key=f"cfy:{cq}"))
                stats["club:founded"] += 1
        cities = {names.he(c) for c in info["cities"]} - {None}
        if len(cities) == 1:
            city = next(iter(cities))
            pool = [names.he(c) for x in clubs_by_country.get(country, []) for c in club_info.get(x, {}).get("cities", set())]
            wrong = pick_distractors(rng, [c for c in pool if c], {city})
            if wrong:
                out.append(Q(f"באיזו עיר נמצא המועדון {ent.he}?", city, wrong, f"{ent.he} ממוקמת ב{city}.", cat,
                             "clubs", "club:city", 0.2 + 0.6 * fame, src, {"club": cq}, key=f"ccity:{cq}"))
                stats["club:city"] += 1
        venues = {v for v in info["venues"] if names.get(v)}
        if len(venues) == 1 and (well_known or next(iter(venues)) in refs[(cq, "venue")]):
            v = next(iter(venues))
            vname = names.he(v)
            pool = [names.he(vv) for x in clubs_by_country.get(country, []) if x != cq for vv in club_info.get(x, {}).get("venues", set())]
            wrong = pick_distractors(rng, [x for x in pool if x], {vname})
            if wrong:
                out.append(Q(f"מהו האצטדיון הביתי של {club_ref(ent)}?", vname, wrong, f"{ent.he} משחקת את משחקי הבית שלה ב{vname}.",
                             "stadiums" if not is_isr else "israeli_football", "stadiums", "club:stadium",
                             0.3 + 0.6 * fame, src + [names.e[v].wd_url], {"club": cq}, volatile=True, key=f"cstad:{cq}"))
                stats["club:stadium"] += 1

    # =========================================================================
    # Ballon d'Or
    # =========================================================================
    bdo = collections.defaultdict(set)
    for r in load("awards"):
        if r.get("awardEn") != "Ballon d'Or" or (r.get("rank") and r["rank"] != "1"):
            continue
        y = year_of(r.get("date"))
        if y and names.get(r["p"]):
            bdo[y].add(r["p"])
    years = sorted(y for y, s in bdo.items() if len(s) == 1)
    winners_by_player = collections.defaultdict(list)
    for y in years:
        winners_by_player[next(iter(bdo[y]))].append(y)
    for y in years:
        pid = next(iter(bdo[y]))
        name = names.he(pid)
        pool = [names.he(next(iter(bdo[o]))) for o in years if abs(o - y) <= 10 and next(iter(bdo[o])) != pid]
        wrong = pick_distractors(rng, [x for x in pool if x], {name})
        if wrong:
            out.append(Q(f"מי זכה בכדור הזהב בשנת {y}?", name, wrong, f"{name} זכה בכדור הזהב ב-{y}.", "legends",
                         "awards", "award:ballon_dor", 0.15 + 0.6 * min(1, (2026 - y) / 60) + 0.2 * fame_obscurity(names.e[pid].sitelinks, 160, 10),
                         [names.e[pid].wd_url, "https://www.wikidata.org/wiki/Q166177"], {"season": str(y)},
                         key=f"bdo:{y}"))
            stats["award:ballon_dor"] += 1
    for pid, ys in winners_by_player.items():
        name = names.he(pid)
        for y in ys[:2]:
            wrong = pick_distractors(rng, [str(o) for o in years if o not in ys and abs(o - y) <= 12], {str(y)})
            if wrong:
                out.append(Q(f"באיזו מהשנים הבאות זכה {name} בכדור הזהב?", str(y), wrong,
                             f"{name} זכה בכדור הזהב ב-{', '.join(map(str, ys))}.", "legends", "awards", "award:ballon_dor_when",
                             0.3 + 0.5 * min(1, (2026 - y) / 60), [names.e[pid].wd_url], {"season": str(y)},
                             key=f"bdow:{pid}:{y}"))
                stats["award:ballon_dor_when"] += 1
    stats["players_used"] = len(players)
    return out, stats
