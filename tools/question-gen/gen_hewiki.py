"""Israeli football from Hebrew Wikipedia (data/hewiki, fetched by fetch-hewiki.mjs).

Facts come from the footballer infobox ("אישיות כדורגל") and editor-maintained
categories; fame comes from 12-month he.wikipedia pageviews (how well-known a
player is to an Israeli audience). Where Wikidata lists the same club for the
player, the question is marked as cross-checked.
"""
from __future__ import annotations

import collections
import json
import random
import re
from pathlib import Path

from qcore import Names, Q, clean_he_title, fame_obscurity, load, normalize_he, pick_distractors

HW = Path("data/hewiki")
LINK = re.compile(r"\[\[([^\]|#]+)(?:\|([^\]]+))?\]\]")
SPLIT = re.compile(r"\{\{\s*ש\s*\}\}|<br\s*/?>", re.I)
YOUTH = re.compile(r"(נוער|עד גיל|נערים|ילדים|קבוצת המילואים|\sב'$|U-?\d)")
ISR_PREFIX = re.compile(r"^(מכבי|הפועל|בית\"ר|בני |עירוני|הכח|הכוח|מ\.ס\.|מועדון ספורט|אחי |שמשון|הכוח|סקציה|אליצור|ביתר)")
POS = {
    "שוער": "שוער",
    "מגן": "מגן", "בלם": "מגן", "מגן ימני": "מגן", "מגן שמאלי": "מגן", "מגן מרכזי": "מגן", "ליברו": "מגן", "בלם מרכזי": "מגן",
    "קשר": "קשר", "קשר אחורי": "קשר", "קשר התקפי": "קשר", "קשר הגנתי": "קשר", "קשר מרכזי": "קשר", "קשר קדמי": "קשר",
    "קשר ימני": "קשר", "קשר שמאלי": "קשר", "קשר כנף": "קשר",
    "חלוץ": "חלוץ", "חלוץ מרכזי": "חלוץ", "חלוץ כנף": "חלוץ", "חלוץ מטרה": "חלוץ",
}
POSITIONS = ["שוער", "מגן", "קשר", "חלוץ"]


def he_url(title: str) -> str:
    return "https://he.wikipedia.org/wiki/" + title.replace(" ", "_")


def fields(box: str) -> dict[str, str]:
    out = {}
    for m in re.finditer(r"\n\|\s*([^=\n|]+?)\s*=(.*?)(?=\n\||\n\}\}|\Z)", box, re.S):
        out[m.group(1).strip()] = m.group(2).strip()
    return out


def items(val: str) -> list[str]:
    return [x.strip() for x in SPLIT.split(val or "")]


def first_link(s: str) -> str | None:
    m = LINK.search(s or "")
    return m.group(1).strip() if m else None


def year(s: str) -> int | None:
    m = re.search(r"(1[89]\d\d|20[0-3]\d)", s or "")
    return int(m.group(1)) if m else None


def base(name: str) -> str:
    n = clean_he_title(name)
    n = re.sub(r"^(מועדון ספורט|מ\.ס\.)\s*", "", n)
    return normalize_he(n)


def build(names: Names, rng: random.Random) -> tuple[list[Q], dict]:
    stats = collections.Counter()
    out: list[Q] = []
    boxes = json.loads((HW / "infoboxes.json").read_text(encoding="utf-8"))
    pv = json.loads((HW / "pageviews.json").read_text(encoding="utf-8"))
    extra = json.loads((HW / "category_members_extra.json").read_text(encoding="utf-8"))
    women = set(extra.get("כדורגלניות ישראליות", []))
    israeli = set(extra.get("כדורגלנים ישראלים", [])) | women
    nt_coaches = set(extra.get("מאמני נבחרת ישראל בכדורגל", []))
    isr_coaches = set(extra.get("מאמני כדורגל ישראלים", []))
    rp = HW / "redirects.json"
    redirects = json.loads(rp.read_text(encoding="utf-8")) if rp.exists() else {}

    def canon(t: str | None) -> str | None:
        return (redirects.get(t) or t) if t else t

    title_to_qid = {e.he_title: q for q, e in names.e.items() if e.he_title}
    isr_club_titles = {r["he"] for r in load("clubs_israeli") if r.get("he")}
    wd_teams = collections.defaultdict(set)
    for r in load("player_teams"):
        wd_teams[r["p"]].add(r["team"])

    def is_isr_club(t: str) -> bool:
        return t in isr_club_titles or bool(ISR_PREFIX.match(clean_he_title(t)))

    # ------------------------------------------------------------- players
    players: dict[str, dict] = {}
    for title, rec in boxes.items():
        box = rec.get("box")
        if not box or "כדורגל" not in box[:40] or title not in israeli and not (rec.get("qid") and title_to_qid.get(title)):
            continue
        if title not in israeli:
            continue
        f = fields(box)
        clubs = []
        yrs = items(f.get("שנים כשחקן", ""))
        for i, it in enumerate(items(f.get("מועדונים כשחקן", ""))):
            t = canon(first_link(it))
            if not t or YOUTH.search(it) or YOUTH.search(t) or "נבחרת" in t:
                continue
            clubs.append({"t": t, "years": (yrs[i] if i < len(yrs) else "").replace("'''", "").strip()})
        coach = []
        for it in items(f.get("קבוצות כמאמן", "")):
            t = canon(first_link(it))
            if not t or re.search(r"(עוזר|נוער|עד גיל|זמני|מנהל|סקאוט|מאמן שוערים|כושר)", it) or YOUTH.search(t):
                continue
            coach.append(t)
        pos_words = {clean_he_title(l.group(1)) for l in LINK.finditer(f.get("תפקיד כשחקן", ""))}
        pos_words |= {clean_he_title(l.group(2)) for l in LINK.finditer(f.get("תפקיד כשחקן", "")) if l.group(2)}
        if not pos_words:
            pos_words = {w.strip() for w in re.split(r"[,/]| ו", re.sub(r"\[\[|\]\]", "", f.get("תפקיד כשחקן", ""))) if w.strip()}
        groups = {POS.get(w) for w in pos_words if w} - {None}
        nt_years = f.get("שנים בנבחרת כשחקן", "")
        nt_end = None
        if "ישראל" in f.get("נבחרת כשחקן", ""):
            ys = [int(y) for y in re.findall(r"(19\d\d|20\d\d)", nt_years)]
            open_ended = bool(re.search(r"[–-]\s*$", nt_years.strip())) or "הווה" in nt_years
            nt_end = None if open_ended or not ys else max(ys)

        def num(k):
            m = re.match(r"^\s*'*(\d{1,3})\b", f.get(k, ""))
            return int(m.group(1)) if m else None

        players[title] = {
            "name": clean_he_title(title), "qid": rec.get("qid"), "pv": pv.get(title, 0), "fem": title in women,
            "clubs": clubs, "coach": coach, "pos": next(iter(groups)) if len(groups) == 1 else None,
            "born": year(f.get("תאריך לידה", "")), "birthplace": canon(first_link(f.get("מקום לידה", ""))),
            "nt_caps": num("הופעות בנבחרת כשחקן") if nt_end else None,
            "nt_goals": num("שערים בנבחרת כשחקן") if nt_end else None, "nt_end": nt_end,
            "bases": {base(c["t"]) for c in clubs},
        }
    # Names must be unambiguous within the pool.
    cnt = collections.Counter(normalize_he(p["name"]) for p in players.values())
    players = {t: p for t, p in players.items() if cnt[normalize_he(p["name"])] == 1 and p["pv"] >= 150}
    stats["hw_players"] = len(players)

    club_count = collections.Counter(c["t"] for p in players.values() for c in p["clubs"])
    isr_pool = [t for t, n in club_count.items() if n >= 12 and is_isr_club(t)]
    foreign_pool = [t for t, n in club_count.items() if n >= 2 and not is_isr_club(t)]
    coach_count = collections.Counter(t for p in players.values() for t in p["coach"])

    def pf(p):  # player obscurity for an Israeli audience
        return fame_obscurity(p["pv"], 40000, 400)

    def cf(t):
        return fame_obscurity(pv.get(t, 0), 150000, 3000)

    def src(p):
        return [he_url(next(t for t, q in players.items() if q is p))] + ([f"https://www.wikidata.org/wiki/{p['qid']}"] if p["qid"] else [])

    # ------------------------------------------------------------- player → club
    for title, p in players.items():
        played = "שיחקה" if p["fem"] else "שיחק"
        name = p["name"]
        uniq, seen = [], set()
        for c in p["clubs"]:
            if base(c["t"]) not in seen:
                seen.add(base(c["t"]))
                uniq.append(c)
        uniq.sort(key=lambda c: -pv.get(c["t"], 0))
        for c in uniq[:3]:
            isr = is_isr_club(c["t"])
            cname = clean_he_title(c["t"])
            src_pool = isr_pool if isr else foreign_pool
            n = club_count[c["t"]]
            # Distractors from the same tier, so the answer isn't simply "the big club".
            tier = [x for x in src_pool if n / 3 <= club_count[x] <= n * 3 and base(x) not in p["bases"]]
            if len(tier) < 6:
                tier = sorted((x for x in src_pool if base(x) not in p["bases"]), key=lambda x: abs(club_count[x] - n))[:12]
            wrong = pick_distractors(rng, [clean_he_title(x) for x in tier], {cname})
            if not wrong:
                continue
            cq = title_to_qid.get(c["t"])
            cross = bool(p["qid"] and cq and cq in wd_teams.get(p["qid"], set()))
            yrs = f" ({c['years']})" if re.match(r"^\d{4}", c["years"] or "") else ""
            text = f"באיזו מהקבוצות הבאות {played} {name}?" if isr else f"באיזו קבוצה מחוץ לישראל {played} {name}?"
            out.append(Q(text, cname, wrong, f"{name} {played} ב{cname}{yrs}.", "israeli_football", "players",
                         "hw:player_club", 0.08 + 0.62 * pf(p) + 0.25 * cf(c["t"]), src(p),
                         {"player": p["qid"] or title, "country": "israel"}, verified_by="hewiki+wikidata" if cross else "hewiki",
                         key=f"pclub:{p['qid'] or title}:{cq or c['t']}"))
            stats["hw:player_club"] += 1

    # ------------------------------------------------------------- club → which player
    by_club = collections.defaultdict(list)
    for title, p in players.items():
        for c in p["clubs"]:
            if is_isr_club(c["t"]) and c["t"] in isr_pool:
                by_club[c["t"]].append(title)
    for ct, titles in by_club.items():
        titles = sorted(set(titles), key=lambda t: -players[t]["pv"])
        cname = clean_he_title(ct)
        for t in titles[:30]:
            p = players[t]
            by = p["born"] or 1980
            pool = [o["name"] for ot, o in players.items() if base(ct) not in o["bases"] and o["fem"] == p["fem"]
                    and abs((o["born"] or 0) - by) <= 8 and o["pv"] >= p["pv"] * 0.3]
            wrong = pick_distractors(rng, pool, {p["name"]})
            if not wrong:
                continue
            verb = "איזו מהשחקניות הבאות שיחקה" if p["fem"] else "איזה מהשחקנים הבאים שיחק"
            cq = title_to_qid.get(ct)
            out.append(Q(f"{verb} ב{cname}?", p["name"], wrong, f"{p['name']} {'שיחקה' if p['fem'] else 'שיחק'} ב{cname}.",
                         "israeli_football", "clubs", "hw:club_which_player", 0.12 + 0.55 * pf(p) + 0.3 * cf(ct),
                         [he_url(t), he_url(ct)], {"club": cq or ct, "country": "israel"}, verified_by="hewiki",
                         key=f"cwp:{cq or ct}:{p['qid'] or t}"))
            stats["hw:club_which_player"] += 1

    # ------------------------------------------------------------- position
    for title, p in players.items():
        if not p["pos"]:
            continue
        played = "שיחקה" if p["fem"] else "שיחק"
        out.append(Q(f"באיזו עמדה {played} {p['name']}?", p["pos"], [x for x in POSITIONS if x != p["pos"]],
                     f"{p['name']} {played} בעמדת {p['pos']}.", "israeli_football", "players", "hw:position",
                     0.12 + 0.75 * pf(p), src(p), {"player": p["qid"] or title, "country": "israel"}, verified_by="hewiki",
                     key=f"ppos:{p['qid'] or title}"))
        stats["hw:position"] += 1

    # ------------------------------------------------------------- birthplace
    bp_count = collections.Counter(p["birthplace"] for p in players.values() if p["birthplace"])
    cities = [c for c, n in bp_count.items() if n >= 6]
    for title, p in players.items():
        c = p["birthplace"]
        if c not in cities:
            continue
        cname = clean_he_title(c)
        wrong = pick_distractors(rng, [clean_he_title(x) for x in cities], {cname})
        if not wrong:
            continue
        born = "נולדה" if p["fem"] else "נולד"
        out.append(Q(f"באיזו עיר {born} {p['name']}?", cname, wrong, f"{p['name']} {born} ב{cname}.", "israeli_football",
                     "players", "hw:birthplace", 0.3 + 0.65 * pf(p), src(p), {"player": p["qid"] or title, "country": "israel"},
                     verified_by="hewiki", key=f"pbp:{p['qid'] or title}"))
        stats["hw:birthplace"] += 1

    # ------------------------------------------------------------- coaches
    coach_pool = [t for t in isr_coaches - nt_coaches if pv.get(t, 0) >= 800]
    for t in nt_coaches:
        if pv.get(t, 0) < 300:
            continue
        name = clean_he_title(t)
        wrong = pick_distractors(rng, [clean_he_title(x) for x in coach_pool], {name})
        if wrong:
            out.append(Q("מי מהבאים אימן את נבחרת ישראל?", name, wrong, f"{name} אימן את נבחרת ישראל בכדורגל.",
                         "israeli_football", "history", "hw:nt_coach", 0.15 + 0.6 * fame_obscurity(pv.get(t, 0), 40000, 400),
                         [he_url(t), he_url("נבחרת ישראל בכדורגל")], {"coach": t, "country": "israel"}, verified_by="hewiki",
                         key=f"ntc:{t}"))
            stats["hw:nt_coach"] += 1
    coach_club_pool = [t for t, n in coach_count.items() if n >= 6 and is_isr_club(t)]
    for title, p in players.items():
        coached = [t for t in dict.fromkeys(p["coach"]) if is_isr_club(t)]
        if not coached:
            continue
        cb = {base(t) for t in p["coach"]}
        for t in sorted(coached, key=lambda x: -pv.get(x, 0))[:2]:
            cname = clean_he_title(t)
            n = coach_count[t]
            tier = [x for x in coach_club_pool if base(x) not in cb and n / 3 <= coach_count[x] <= n * 3]
            if len(tier) < 6:
                tier = [x for x in coach_club_pool if base(x) not in cb]
            wrong = pick_distractors(rng, [clean_he_title(x) for x in tier], {cname})
            if not wrong:
                continue
            verb = "אימנה" if p["fem"] else "אימן"
            out.append(Q(f"איזו מהקבוצות הבאות {verb} {p['name']}?", cname, wrong, f"{p['name']} {verb} את {cname}.",
                         "israeli_football", "clubs", "hw:coached_club", 0.2 + 0.55 * pf(p) + 0.2 * cf(t), src(p),
                         {"player": p["qid"] or title, "country": "israel"}, verified_by="hewiki",
                         key=f"coach:{p['qid'] or title}:{t}"))
            stats["hw:coached_club"] += 1

    # ------------------------------------------------------------- national team records (retired only)
    nt = [p for p in players.values() if p["nt_end"] and p["nt_end"] <= 2021 and p["nt_caps"] and p["nt_caps"] >= 10]
    nt.sort(key=lambda p: -p["pv"])
    for stat, label, text in (("nt_goals", "שערים", "כבש הכי הרבה שערים"), ("nt_caps", "הופעות", "שיחק הכי הרבה משחקים")):
        cand = [p for p in nt[:220] if p[stat] is not None and not p["fem"]]
        made = set()
        for _ in range(400):
            four = rng.sample(cand, 4) if len(cand) >= 4 else []
            if not four:
                break
            four.sort(key=lambda p: -p[stat])
            vals = [p[stat] for p in four]
            if vals[0] - vals[1] < 3 or len(set(vals)) < 4:
                continue
            k = tuple(sorted(p["name"] for p in four))
            if k in made:
                continue
            made.add(k)
            top = four[0]
            out.append(Q(f"מי מהשחקנים הבאים {text} בנבחרת ישראל?", top["name"], [p["name"] for p in four[1:]],
                         f"{top['name']}: {top[stat]} {label} בנבחרת. " + ", ".join(f"{p['name']}: {p[stat]}" for p in four[1:]) + ".",
                         "israeli_football", "records", f"hw:nt_{stat}", 0.35 + 0.45 * sum(pf(p) for p in four) / 4,
                         [src(p)[0] for p in four], {"country": "israel"}, verified_by="hewiki",
                         key=f"{stat}:{'|'.join(k)}"))
            stats[f"hw:{stat}"] += 1
            if len(made) >= 120:
                break
    return out, stats
