"""Questions from openfootball match data (CC0): World Cup history and league tables."""
from __future__ import annotations

import collections
import json
import random
import re
import unicodedata
from pathlib import Path

from qcore import Q, Names, be, le, load, national_display, numeric_distractors, pick_distractors, recency_obscurity, fame_obscurity

# openfootball team names that differ from the Wikidata/Wikipedia country name.
NT_ALIASES = {
    "west germany": "germany", "east germany": "east germany", "soviet union": "soviet union",
    "korea republic": "south korea", "korea dpr": "north korea", "usa": "united states",
    "ir iran": "iran", "china pr": "china", "côte d'ivoire": "ivory coast", "cote d'ivoire": "ivory coast",
    "czech republic": "czech republic", "czechia": "czech republic", "dutch east indies": "dutch east indies",
    "zaire": "dr congo", "bosnia-herzegovina": "bosnia and herzegovina", "republic of ireland": "republic of ireland",
    "serbia and montenegro": "serbia and montenegro", "türkiye": "turkey", "cabo verde": "cape verde",
    "curaçao": "curaçao",
}


def strip_accents(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFKD", s) if not unicodedata.combining(c))


def nt_index(names: Names) -> dict[str, str]:
    """english country name -> national team qid (from English Wikipedia titles)."""
    idx = {}
    rx = re.compile(r"^(.*?) (?:men's )?national (?:association )?(?:football|soccer) team$", re.I)
    nt_ids = {r["t"] for r in load("national_teams")} | {r["team"] for r in load("player_teams") if r.get("isNational") == "true"}
    for qid in nt_ids:
        ent = names.e.get(qid)
        if not ent or not ent.en_title:
            continue
        if re.search(r"women|under-|U-?\d|olympic|amateur|B team|futsal|beach|youth", ent.en_title, re.I):
            continue
        m = rx.match(ent.en_title)
        if m:
            k = strip_accents(m.group(1)).lower()
            # several items can share a name (e.g. historic teams): keep the best-known
            if k not in idx or names.e[qid].sitelinks > names.e[idx[k]].sitelinks:
                idx[k] = qid
    return idx


def resolve_nt(idx: dict[str, str], name: str) -> str | None:
    k = strip_accents(name).lower().strip()
    k = NT_ALIASES.get(k, k)
    return idx.get(strip_accents(k))


def final_result(m: dict) -> tuple[int, int, str] | None:
    """(goals1, goals2, how) where how in {'', 'et', 'p:a-b'} — winner decided incl. shootout."""
    s = m.get("score")
    if isinstance(s, list) and len(s) == 2:
        return s[0], s[1], ""
    if isinstance(s, dict):
        if "et" in s:
            a, b = s["et"]
            if a == b and "p" in s:
                pa, pb = s["p"]
                return a, b, f"p:{pa}-{pb}"
            return a, b, "et"
        if "ft" in s:
            a, b = s["ft"]
            if a == b and "p" in s:
                pa, pb = s["p"]
                return a, b, f"p:{pa}-{pb}"
            return a, b, ""
    return None


def winner_of(m: dict) -> tuple[str, str] | None:
    r = final_result(m)
    if not r:
        return None
    a, b, how = r
    if how.startswith("p:"):
        pa, pb = map(int, how[2:].split("-"))
        return (m["team1"], m["team2"]) if pa > pb else (m["team2"], m["team1"])
    if a == b:
        return None
    return (m["team1"], m["team2"]) if a > b else (m["team2"], m["team1"])


def world_cup(names: Names, rng: random.Random, of_dir: Path, crosscheck: dict) -> tuple[list[Q], dict]:
    stats = collections.Counter()
    idx = nt_index(names)
    nt_he = lambda q: national_display(names.get(q).he_title) if names.get(q) else None  # noqa: E731
    out: list[Q] = []
    tournaments = {}
    for f in sorted((of_dir / "worldcup.json").glob("*/worldcup.json")):
        year = int(f.parent.name)
        ms = json.loads(f.read_text(encoding="utf-8"))["matches"]
        tournaments[year] = ms

    wins = collections.defaultdict(list)       # nt qid -> years won
    finals = {}
    all_teams_by_year = {}
    for year, ms in tournaments.items():
        teams = {t for m in ms for t in (m.get("team1"), m.get("team2")) if t}
        q_teams = {resolve_nt(idx, t) for t in teams}
        if None in q_teams:
            stats["wc_unmapped_team_years"] += 1
            missing = [t for t in teams if not resolve_nt(idx, t)]
            stats.update({f"unmapped:{t}": 1 for t in missing})
        all_teams_by_year[year] = {q for q in q_teams if q}
        fin = [m for m in ms if m.get("round") == "Final"]
        if len(fin) != 1:
            continue
        w = winner_of(fin[0])
        if not w:
            continue
        wq, lq = resolve_nt(idx, w[0]), resolve_nt(idx, w[1])
        if not wq or not lq:
            continue
        crosscheck[("Q19317", year)] = wq   # used by gen_competitions to verify Wikidata
        finals[year] = (fin[0], wq, lq)
        wins[wq].append(year)

    years = sorted(finals)
    for year in years:
        m, wq, lq = finals[year]
        wn, ln = nt_he(wq), nt_he(lq)
        if not wn or not ln:
            continue
        src = ["https://github.com/openfootball/worldcup.json", f"https://www.wikidata.org/wiki/{wq}"]
        obs = 0.6 * recency_obscurity(year)
        # Runner-up
        pool = [nt_he(q) for y in years for q in (finals[y][1], finals[y][2]) if abs(y - year) <= 16]
        wrong = pick_distractors(rng, [p for p in pool if p], {wn, ln})
        if wrong:
            out.append(Q(f"מי הייתה היריבה של {wn} בגמר המונדיאל {year}?", ln, wrong,
                         f"בגמר המונדיאל {year} גברה {wn} על {ln}.", "world_cup", "history", "wc:runner_up",
                         0.1 + obs, src, {"season": str(year)}, verified_by="openfootball", key=f"wc:ru:{year}"))
            stats["wc:runner_up"] += 1
        # Goals in the final
        a, b, how = final_result(m)
        total = a + b
        wrong = numeric_distractors(rng, total, [-3, -2, -1, 1, 2, 3], lo=0)
        extra = "בתום 90 הדקות" if how == "" else "כולל הארכה, לא כולל דו-קרב פנדלים"
        out.append(Q(f"כמה שערים הובקעו בגמר המונדיאל {year} ({extra})?", str(total), wrong,
                     f"גמר המונדיאל {year} בין {wn} {le(ln)} הסתיים בתוצאה {max(a, b)}:{min(a, b)}" +
                     (" אחרי הארכה." if how == "et" else " ונפתח בפנדלים." if how.startswith("p") else "."),
                     "world_cup", "records", "wc:final_goals", 0.45 + obs * 0.6, src,
                     {"season": str(year)}, verified_by="openfootball", key=f"wc:fg:{year}"))
        stats["wc:final_goals"] += 1
        # Decided on penalties?
        if how.startswith("p"):
            pa, pb = map(int, how[2:].split("-"))
            out.append(Q(f"איך הוכרע גמר המונדיאל {year} בין {wn} {le(ln)}?", "בדו-קרב פנדלים",
                         ["בזמן משחק רגיל", "בהארכה", "בשער זהב"],
                         f"הגמר הסתיים בתיקו {a}:{b} ו{wn} ניצחה בפנדלים {max(pa, pb)}:{min(pa, pb)}.",
                         "world_cup", "iconic_moments", "wc:decided_how", 0.25 + obs * 0.5, src,
                         {"season": str(year)}, verified_by="openfootball", key=f"wc:how:{year}"))
            stats["wc:decided_how"] += 1

    # Semi-finalists and participants
    for year, ms in tournaments.items():
        if year not in finals:
            continue
        semis = [m for m in ms if re.match(r"semi", m.get("round", ""), re.I)]
        sf_teams = {resolve_nt(idx, t) for m in semis for t in (m["team1"], m["team2"])}
        sf_teams.discard(None)
        if len(sf_teams) == 4:
            non_sf = [nt_he(q) for q in all_teams_by_year[year] - sf_teams]
            for q in sf_teams:
                n = nt_he(q)
                wrong = pick_distractors(rng, [x for x in non_sf if x], {n})
                if n and wrong:
                    out.append(Q(f"איזו מהנבחרות הבאות הגיעה לחצי הגמר במונדיאל {year}?", n, wrong,
                                 f"{n} הייתה אחת מארבע הנבחרות בחצי הגמר של מונדיאל {year}.",
                                 "world_cup", "history", "wc:semifinalist",
                                 0.35 + 0.6 * recency_obscurity(year) + 0.2 * fame_obscurity(names.get(q).sitelinks),
                                 ["https://github.com/openfootball/worldcup.json"], {"season": str(year)},
                                 verified_by="openfootball", key=f"wc:sf:{year}:{q}"))
                    stats["wc:semifinalist"] += 1

    # Titles count and first title (data covers every tournament since 1930)
    if len(finals) >= 21:
        last = max(years)
        for q, ys in wins.items():
            n = nt_he(q)
            if not n:
                continue
            c = len(ys)
            wrong = numeric_distractors(rng, c, [-2, -1, 1, 2, 3], lo=1)
            out.append(Q(f"כמה פעמים זכתה {n} במונדיאל (עד {last})?", str(c), wrong,
                         f"{n} זכתה במונדיאל {c} פעמים: {', '.join(map(str, sorted(ys)))}.",
                         "world_cup", "records", "wc:title_count", 0.15, ["https://github.com/openfootball/worldcup.json"],
                         {}, verified_by="openfootball+wikidata", volatile=True, key=f"wc:cnt:{q}"))
            first = min(ys)
            wrong = pick_distractors(rng, [str(y) for y in years if y != first and not (y in ys)], {str(first)})
            if wrong:
                out.append(Q(f"באיזו שנה זכתה {n} במונדיאל בפעם הראשונה?" if c > 1 else f"באיזו שנה זכתה {n} במונדיאל?", str(first), wrong,
                             f"התואר הראשון של {n} הגיע במונדיאל {first}.", "world_cup", "history", "wc:first_title",
                             0.3 + 0.3 * recency_obscurity(first), ["https://github.com/openfootball/worldcup.json"],
                             {}, verified_by="openfootball", key=f"wc:first:{q}"))
            stats["wc:titles"] += 1
    return out, stats


# ---------------------------------------------------------------------------
# League tables 2010/11 onwards
# ---------------------------------------------------------------------------
LEAGUES = {
    "en.1": ("הפרמייר ליג", "premier_league", "ENG"),
    "es.1": ("לה ליגה", "la_liga", "Q324867"),
    "it.1": ("הסרייה א'", "serie_a", "Q15804"),
    "de.1": ("הבונדסליגה", "bundesliga", "Q82595"),
    "fr.1": ("הליגה הצרפתית", "ligue_1", "Q13394"),
}
GENERIC = {"fc", "cf", "afc", "sc", "ssc", "ac", "as", "ss", "us", "ud", "cd", "rcd", "sd", "rc", "fk", "club", "de",
           "calcio", "futbol", "football", "cfc", "sk", "the", "sv", "vfl", "vfb", "tsg", "bsc", "osc", "ogc", "ca", "aj",
           "sco", "fco", "hsc", "rb", "sm", "ea", "esbjerg", "and", "albion"}
CLUB_ALIASES = {
    "athletic": "athletic bilbao", "atletico madrid": "atletico madrid", "inter": "inter milan",
    "internazionale": "inter milan", "milan": "ac milan", "bayern munchen": "bayern munich",
    "paris saint germain": "paris saint germain", "psg": "paris saint germain", "betis": "real betis",
    "celta vigo": "celta de vigo", "wolverhampton wanderers": "wolverhampton wanderers",
    "bor monchengladbach": "borussia monchengladbach", "alaves": "deportivo alaves", "celta": "celta de vigo",
    "espanyol barcelona": "espanyol", "rayo vallecano madrid": "rayo vallecano", "real betis balompie": "real betis",
    "real racing santander": "racing santander", "guingamp": "en avant guingamp", "estac troyes": "es troyes",
    "strasbourg": "strasbourg alsace", "racing lens": "lens", "caen": "stade malherbe caen",
    "evian thonon gaillard": "thonon evian grand geneve", "atalanta": "atalanta bc", "chievo verona": "chievoverona",
    "internazionale milano": "inter milan", "lazio roma": "lazio", "spal ferrara": "spal", "sampdoria": "uc sampdoria",
}


def norm_club(s: str) -> str:
    s = strip_accents(s).lower()
    s = re.sub(r"[^a-z0-9 ]", " ", s)
    toks = [t for t in s.split() if t not in GENERIC and not t.isdigit() and len(t) > 1]
    out = " ".join(toks)
    return CLUB_ALIASES.get(out, out)


def club_index(names: Names) -> dict[str, list[str]]:
    idx = collections.defaultdict(list)
    club_ids = {r["c"] for r in load("clubs_top")} | {r["c"] for r in load("clubs_israeli")} | {r["team"] for r in load("player_teams") if r.get("isNational") == "false"}
    for qid in club_ids:
        ent = names.e.get(qid)
        if ent and ent.en_title and not re.search(r"\b(B|II|U\d+|youth|reserves|women|Ladies|Féminin)\b", ent.en_title, re.I):
            idx[norm_club(re.sub(r"\s*\(.*\)$", "", ent.en_title))].append(qid)
    return idx


def leagues(names: Names, rng: random.Random, of_dir: Path, crosscheck: dict) -> tuple[list[Q], dict]:
    stats = collections.Counter()
    idx = club_index(names)

    def resolve(name: str) -> str | None:
        hits = idx.get(norm_club(name), [])
        if len(hits) == 1:
            return hits[0]
        if len(hits) > 1:  # prefer the most notable entity
            return max(hits, key=lambda q: names.e[q].sitelinks)
        return None

    out: list[Q] = []
    for season_dir in sorted((of_dir / "football.json").glob("20*")):
        m = re.match(r"^(\d{4})-(\d{2})$", season_dir.name)
        if not m:
            continue
        end = int(m.group(1)) + 1
        label = f"{m.group(1)}/{m.group(2)}"
        for code, (lname, cat, comp) in LEAGUES.items():
            f = season_dir / f"{code}.json"
            if not f.exists():
                continue
            ms = json.loads(f.read_text(encoding="utf-8"))["matches"]
            teams = sorted({t for x in ms for t in (x["team1"], x["team2"])})
            played = [x for x in ms if isinstance(x.get("score"), dict) and "ft" in x["score"]]
            if len(played) != len(teams) * (len(teams) - 1):
                stats[f"incomplete:{code}:{label}"] += 1
                continue
            tab = {t: {"pts": 0, "gf": 0, "ga": 0} for t in teams}
            for x in played:
                a, b = x["score"]["ft"]
                t1, t2 = x["team1"], x["team2"]
                tab[t1]["gf"] += a; tab[t1]["ga"] += b; tab[t2]["gf"] += b; tab[t2]["ga"] += a
                if a > b: tab[t1]["pts"] += 3
                elif b > a: tab[t2]["pts"] += 3
                else: tab[t1]["pts"] += 1; tab[t2]["pts"] += 1
            order = sorted(teams, key=lambda t: (-tab[t]["pts"], -(tab[t]["gf"] - tab[t]["ga"]), -tab[t]["gf"]))
            qids = {t: resolve(t) for t in teams}
            he = {t: names.he(qids[t]) for t in teams}
            unmapped = [t for t in teams if not he[t]]
            stats.update({f"unmapped_club:{t}": 1 for t in unmapped})
            champ = order[0]
            # Champion must be clear (points deductions could flip a tight race).
            if tab[order[0]]["pts"] - tab[order[1]]["pts"] >= 1 and qids[champ]:
                crosscheck[(comp, end)] = qids[champ]
            src = [f"https://github.com/openfootball/football.json/tree/master/{season_dir.name}"]
            # Most goals scored (unique maximum)
            by_gf = sorted(teams, key=lambda t: -tab[t]["gf"])
            if tab[by_gf[0]]["gf"] > tab[by_gf[1]]["gf"] and he[by_gf[0]]:
                pool = [he[t] for t in by_gf[1:8] if he[t]]
                wrong = pick_distractors(rng, pool, {he[by_gf[0]]})
                if wrong:
                    out.append(Q(f"איזו קבוצה כבשה הכי הרבה שערים {be(lname)} בעונת {label}?", he[by_gf[0]], wrong,
                                 f"{he[by_gf[0]]} כבשה {tab[by_gf[0]]['gf']} שערים בליגה באותה עונה.",
                                 cat, "records", "league:most_goals", 0.45 + 0.5 * recency_obscurity(end), src,
                                 {"season": label}, verified_by="openfootball", key=f"{code}:gf:{label}"))
                    stats["league:most_goals"] += 1
            # Best defence (unique minimum)
            by_ga = sorted(teams, key=lambda t: tab[t]["ga"])
            if tab[by_ga[0]]["ga"] < tab[by_ga[1]]["ga"] and he[by_ga[0]]:
                pool = [he[t] for t in by_ga[1:8] if he[t]]
                wrong = pick_distractors(rng, pool, {he[by_ga[0]]})
                if wrong:
                    out.append(Q(f"איזו קבוצה ספגה הכי מעט שערים {be(lname)} בעונת {label}?", he[by_ga[0]], wrong,
                                 f"{he[by_ga[0]]} ספגה רק {tab[by_ga[0]]['ga']} שערים בליגה באותה עונה.",
                                 cat, "records", "league:best_defence", 0.55 + 0.45 * recency_obscurity(end), src,
                                 {"season": label}, verified_by="openfootball", key=f"{code}:ga:{label}"))
                    stats["league:best_defence"] += 1
            # Runner-up, only when clearly ahead of third (no deduction can change it)
            if tab[order[1]]["pts"] - tab[order[2]]["pts"] >= 4 and he[order[1]]:
                pool = [he[t] for t in order[2:7] if he[t]] + ([he[order[0]]] if he[order[0]] else [])
                wrong = pick_distractors(rng, pool, {he[order[1]]})
                if wrong:
                    out.append(Q(f"מי סיימה במקום השני {be(lname)} בעונת {label}?", he[order[1]], wrong,
                                 f"{he[order[1]]} סיימה שנייה עם {tab[order[1]]['pts']} נקודות.",
                                 cat, "history", "league:runner_up", 0.45 + 0.5 * recency_obscurity(end), src,
                                 {"season": label}, verified_by="openfootball", key=f"{code}:ru:{label}"))
                    stats["league:runner_up"] += 1
            # Champion's points
            if he[champ] and tab[order[0]]["pts"] - tab[order[1]]["pts"] >= 1:
                p = tab[champ]["pts"]
                wrong = numeric_distractors(rng, p, [-7, -5, -3, -2, 2, 3, 5, 6], lo=40, hi=114)
                if len(wrong) == 3:
                    out.append(Q(f"כמה נקודות צברה {he[champ]} בעונת האליפות {label} {be(lname)}?", str(p), wrong,
                                 f"{he[champ]} זכתה באליפות {label} עם {p} נקודות.",
                                 cat, "records", "league:champion_points", 0.7 + 0.3 * recency_obscurity(end), src,
                                 {"season": label}, verified_by="openfootball", key=f"{code}:pts:{label}"))
                    stats["league:champion_points"] += 1
    return out, stats
