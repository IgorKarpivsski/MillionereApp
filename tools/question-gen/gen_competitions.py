"""Competition winners (Wikidata seasons), cross-checked where a second source exists."""
from __future__ import annotations

import collections
import random
import re

from qcore import Q, Names, be, load, national_display, numeric_distractors, pick_distractors, recency_obscurity, fame_obscurity, year_of

# qid -> (hebrew phrase used after "ב", category, kind, base obscurity)
COMPS = {
    "Q19317": ("מונדיאל", "world_cup", "nt", 0.0),
    "Q260858": ("יורו", "international", "nt", 0.15),
    "Q178750": ("קופה אמריקה", "international", "nt", 0.35),
    "Q83145": ("גביע אפריקה לאומות", "international", "nt", 0.55),
    "Q18756": ("ליגת האלופות", "champions_league", "club", 0.1),
    "Q18760": ("הליגה האירופית", "international", "club", 0.35),
    "Q223366": ("אליפות העולם לקבוצות", "international", "club", 0.45),
    "Q9448": ("אליפות אנגליה", "premier_league", "club", 0.15),
    "Q754839": ("אליפות אנגליה", "premier_league", "club", 0.35),
    "Q11151": ("הגביע האנגלי", "premier_league", "club", 0.35),
    "Q324867": ("אליפות ספרד", "la_liga", "club", 0.15),
    "Q483794": ("גביע המלך הספרדי", "la_liga", "club", 0.4),
    "Q15804": ("אליפות איטליה", "serie_a", "club", 0.2),
    "Q82595": ("אליפות גרמניה", "bundesliga", "club", 0.2),
    "Q13394": ("אליפות צרפת", "ligue_1", "club", 0.3),
    "Q477309": ("אליפות ישראל", "israeli_football", "club", 0.0),
    "Q1165593": ("גביע המדינה", "israeli_football", "club", 0.1),
    "Q1377843": ("גביע הטוטו", "israeli_football", "club", 0.45),
    # Israeli top flight before 1999 (year-limited below)
    "Q1824581": ("אליפות ישראל", "israeli_football", "club", 0.2),
    "Q6545712": ("אליפות ישראל", "israeli_football", "club", 0.3),
}
# Same competition under two Wikidata items -> one pool of winners.
POOL = {"Q754839": "ENG", "Q9448": "ENG", "Q1824581": "ISR", "Q6545712": "ISR", "Q477309": "ISR"}
# Only seasons in which that league was the top flight.
TOP_FLIGHT_YEARS = {"Q1824581": (1955, 1999), "Q6545712": (1949, 1955), "Q754839": (1888, 1992)}

SEASON_RE = re.compile(r"^(\d{4})(?:\s*[–-]\s*(\d{2,4}))?")


def season_label(r: dict) -> tuple[str, int] | None:
    """('2009/10', 2010) for split seasons, ('1986', 1986) for single-year ones."""
    lbl = r.get("seasonEn") or ""
    if re.search(r"qualif|women|youth|under-|U-\d|play-?off|squad", lbl, re.I):
        return None
    m = SEASON_RE.match(lbl)
    if not m:
        y = year_of(r.get("pit")) or year_of(r.get("start"))
        return (str(y), y) if y else None
    a = int(m.group(1))
    if m.group(2):
        b = m.group(2)
        end = int(b) if len(b) == 4 else int(str(a)[:2] + b) if int(b) > a % 100 else int(str(a + 100)[:2] + b)
        if end != a + 1:
            return None
        return (f"{a}/{str(end)[2:]}", end)
    return (str(a), a)


def winner_name(names: Names, kind: str, qid: str) -> str | None:
    ent = names.get(qid)
    if not ent:
        return None
    if kind == "nt":
        name = national_display(ent.he_title)
        return name if name and "נבחרת" not in name else None
    return ent.he


def build(names: Names, rng: random.Random, crosscheck: dict) -> tuple[list[Q], dict]:
    rows = load("seasons") + load("seasons_israel_history")
    seasons: dict[str, dict] = {}
    for r in rows:
        comp = r["comp"]
        if comp not in COMPS:
            continue
        s = seasons.setdefault(r["season"], {"comp": comp, "rows": [], "winners": set()})
        s["rows"].append(r)
        if r.get("winner") and (not r.get("rank") or r["rank"] in ("1",)):
            s["winners"].add(r["winner"])

    facts = []  # (comp, pool, label, end_year, winner_qid, season_qid)
    for sid, s in seasons.items():
        if len(s["winners"]) != 1:
            continue
        lab = season_label(s["rows"][0])
        if not lab:
            continue
        comp = s["comp"]
        lo_hi = TOP_FLIGHT_YEARS.get(comp)
        if lo_hi and not (lo_hi[0] < lab[1] <= lo_hi[1]):
            continue
        facts.append((comp, POOL.get(comp, comp), lab[0], lab[1], next(iter(s["winners"])), sid))

    stats = collections.Counter()
    # Conflicting winners for the same season (duplicate Wikidata items) -> drop all.
    per_season = collections.defaultdict(set)
    for f in facts:
        nm = winner_name(names, COMPS[f[0]][2], f[4]) or f[4]
        per_season[(f[1], f[2])].add(nm)
    conflicted = {k for k, v in per_season.items() if len(v) > 1}
    stats["season_conflict_dropped"] = sum(1 for f in facts if (f[1], f[2]) in conflicted)
    facts = [f for f in facts if (f[1], f[2]) not in conflicted]
    # Cross-check against openfootball where both sources cover the season.
    checked = []
    for f in facts:
        comp, pool, label, end, w, sid = f
        key = (pool if pool == "ENG" else comp, end)
        other = crosscheck.get(key)
        if other is not None:
            same_name = names.he(other) and names.he(other) == names.he(w)
            if other != w and not same_name:
                stats["crosscheck_mismatch_dropped"] += 1
                stats[f"mismatch:{label}:{COMPS[comp][0]}:wikidata={names.he(w) or w}:openfootball={names.he(other) or other}"] += 1
                continue
            stats["crosscheck_agreed"] += 1
            checked.append((*f, True))
        else:
            checked.append((*f, False))

    by_pool: dict[str, list] = collections.defaultdict(list)
    for f in checked:
        by_pool[f[1]].append(f)

    out: list[Q] = []
    for pool, fs in by_pool.items():
        fs.sort(key=lambda f: f[3])
        comp0 = fs[0][0]
        phrase, cat, kind, base = COMPS[comp0]
        # winner per season (for the reverse question)
        won_by: dict[str, set[str]] = collections.defaultdict(set)
        for f in fs:
            won_by[f[4]].add(f[2])
        for comp, _, label, end, w, sid, verified in fs:
            wname = winner_name(names, kind, w)
            if not wname:
                continue
            near = [winner_name(names, kind, f[4]) for f in fs if abs(f[3] - end) <= 12 and f[4] != w]
            wrong = pick_distractors(rng, [n for n in near if n], {wname})
            if not wrong:
                wrong = pick_distractors(rng, [winner_name(names, kind, f[4]) for f in fs if f[4] != w], {wname})
            if not wrong:
                continue
            ent = names.get(w)
            season_ent = names.get(sid)
            is_split = "/" in label
            when = f"בעונת {label}" if is_split else label
            verb = "זכתה"
            ph = "גביע האלופות" if comp == "Q18756" and end <= 1992 else phrase
            text = f"מי {verb} {be(ph)} {when}?" if is_split else f"מי {verb} {be(ph)} {label}?"
            obsc = 0.45 * recency_obscurity(end) + 0.25 * fame_obscurity(ent.sitelinks if ent else 10) + 0.3 * base
            srcs = [u for u in [season_ent.he_url if season_ent else None, f"https://www.wikidata.org/wiki/{sid}"] if u]
            out.append(Q(
                text=text, correct=wname, wrong=wrong,
                explanation=f"{wname} זכתה {be(ph)} {when}.",
                category=cat, topic="clubs" if kind == "club" else "international",
                template=f"winner:{pool}", obscurity=obsc, sources=srcs,
                tags={"season": label, "competition": comp},
                verified_by="wikidata+openfootball" if verified else "wikidata",
                key=f"{pool}:{label}",
            ))
            stats[f"winner:{phrase}"] += 1

        # Reverse: "in which of these seasons did X win ...?"
        for w, won in won_by.items():
            wname = winner_name(names, kind, w)
            if not wname or len(fs) < 8:
                continue
            for label in sorted(won)[-3:]:  # at most 3 per winner
                f_end = next(f[3] for f in fs if f[2] == label)
                others = [f[2] for f in fs if f[4] != w and abs(f[3] - f_end) <= 15 and f[2] not in won]
                wrong = pick_distractors(rng, others, {label})
                if not wrong:
                    continue
                is_split = "/" in label
                q_when = "באיזו מהעונות הבאות" if is_split else "באיזו מהשנים הבאות"
                ent = names.get(w)
                obsc = 0.4 * recency_obscurity(f_end) + 0.2 * fame_obscurity(ent.sitelinks if ent else 10) + 0.3 * base + 0.1
                out.append(Q(
                    text=f"{q_when} זכתה {wname} {be(phrase)}?", correct=label, wrong=wrong,
                    explanation=f"{wname} זכתה {be(phrase)} {'בעונת ' if is_split else 'ב-'}{label}.",
                    category=cat, topic="history", template=f"won_when:{pool}", obscurity=obsc,
                    sources=[f"https://www.wikidata.org/wiki/{next(f[5] for f in fs if f[2] == label)}"],
                    tags={"season": label, "competition": comp}, key=f"{pool}:{w}:{label}",
                ))
                stats[f"won_when:{phrase}"] += 1
    return out, stats
