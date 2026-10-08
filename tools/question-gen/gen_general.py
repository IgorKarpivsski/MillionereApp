"""
General-knowledge question generator for "האלוף".

Builds Hebrew multiple-choice questions from open data fetched by
fetch-general.mjs (data/general/*.json):

  * Wikidata (CC0) — every fact, with its item linked as the source.
  * Hebrew Wikipedia article titles — every name shown to the player.
  * Wikimedia Commons — photos (flags, animals, landmarks, paintings, ...) with
    author + license shown under the image.

Same rules as the football bank: a question is only emitted when its single
correct answer is certain and every distractor is certainly wrong according to
the full data; ambiguous subjects (several capitals, several countries, ...)
are skipped; dull "which year" questions are capped.

    python3 tools/question-gen/gen_general.py --data data/general --out content/general
"""
from __future__ import annotations

import argparse
import collections
import hashlib
import json
import math
import random
import re
import unicodedata
from dataclasses import dataclass, field
from pathlib import Path

GEN = "general-2026.10.1"
HEB = re.compile(r"[֐-׿]")
LATIN = re.compile(r"[A-Za-z]")
ALIVE_YEAR = 2026

# ---------------------------------------------------------------------------
# Loading
# ---------------------------------------------------------------------------
DATA: Path


def load(name: str) -> list[dict]:
    p = DATA / f"{name}.json"
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else []


def year_of(s: str | None) -> int | None:
    if not s:
        return None
    m = re.match(r"^(-?)0*(\d{1,4})-", s)
    if not m:
        return None
    y = int(m.group(2))
    return -y if m.group(1) else y


def num(s) -> float | None:
    try:
        return float(s)
    except (TypeError, ValueError):
        return None


def clean_title(t: str) -> str:
    t = re.sub(r"\s*\([^)]*\)\s*$", "", t).strip()
    return t


@dataclass
class Ent:
    qid: str
    he: str | None = None
    he_title: str | None = None
    en: str | None = None
    sl: int = 0

    @property
    def sources(self) -> list[str]:
        out = [f"https://www.wikidata.org/wiki/{self.qid}"]
        if self.he_title:
            out.append(f"https://he.wikipedia.org/wiki/{self.he_title.replace(' ', '_')}")
        return out


class Names:
    def __init__(self):
        self.e: dict[str, Ent] = {}
        for r in load("titles"):
            q = r.get("e")
            if not q:
                continue
            ent = self.e.setdefault(q, Ent(q))
            he = r.get("he")
            if he and HEB.search(he) and not ent.he:
                ent.he_title = he
                ent.he = clean_title(he)
            if r.get("en") and not ent.en:
                ent.en = r["en"]
            if r.get("sl"):
                ent.sl = max(ent.sl, int(r["sl"]))

    def get(self, q: str | None) -> Ent | None:
        if not q:
            return None
        e = self.e.get(q)
        if not e or not e.he:
            return None
        # Names shown as answers must be plain Hebrew, short, no Latin letters.
        if LATIN.search(e.he) or len(e.he) > 40:
            return None
        return e

    def he(self, q: str | None) -> str | None:
        e = self.get(q)
        return e.he if e else None


N: Names


# ---------------------------------------------------------------------------
# Commons images
# ---------------------------------------------------------------------------
COMMONS: dict[str, dict] = {}
OK_LICENSE = re.compile(r"(CC0|Public domain|PD|CC BY|CC-BY|GFDL|Attribution|FAL|Free Art)", re.I)


def photo(file: str | None, fit: str = "cover") -> dict | None:
    if not file:
        return None
    c = COMMONS.get(file)
    if not c or c.get("missing") or not c.get("thumb"):
        return None
    lic = (c.get("license") or "").strip()
    if not lic or not OK_LICENSE.search(lic):
        return None
    if c.get("w") and c.get("h") and (c["w"] < 160 or c["h"] < 100):
        return None
    if c.get("mime") not in ("image/jpeg", "image/png", "image/svg+xml", "image/webp", "image/gif", "image/tiff"):
        return None
    artist = re.sub(r"\s+", " ", c.get("artist") or "").strip()
    if not artist or len(artist) > 60:
        artist = artist[:57] + "…" if artist else ""
    credit = f"{artist} · {lic} · ויקישיתוף" if artist else f"{lic} · ויקישיתוף"
    return {
        "kind": "photo",
        "url": c["thumb"],
        "credit": credit[:200],
        "license": lic[:60],
        "page": c.get("page"),
        "fit": fit,
        "w": c.get("w"),
        "h": c.get("h"),
    }


# ---------------------------------------------------------------------------
# Question model
# ---------------------------------------------------------------------------
@dataclass
class Q:
    text: str
    correct: str
    wrong: list[str]
    explanation: str
    category: str
    template: str
    obscurity: float
    sources: list[str]
    image: dict | None = None
    key: str = ""
    volatile: bool = False
    tags: dict = field(default_factory=dict)


def norm(s: str) -> str:
    s = unicodedata.normalize("NFKC", s or "")
    s = re.sub(r"[\"'׳״`\-–—.,()]", "", s)
    return re.sub(r"\s+", " ", s).strip().lower()


def answers_ok(q: Q) -> bool:
    opts = [q.correct, *q.wrong]
    if len(opts) != 4 or len({norm(o) for o in opts}) != 4:
        return False
    if any(not o or len(o) > 60 for o in opts):
        return False
    if not (8 <= len(q.text) <= 200):
        return False
    c = norm(q.correct)
    if c and not c.isdigit() and len(c) > 2 and c in norm(q.text):
        return False
    return True


def fame(sl: int, hi: float, lo: float) -> float:
    s = max(1, sl)
    x = (math.log(hi) - math.log(s)) / (math.log(hi) - math.log(lo))
    return min(1.0, max(0.0, x))


rng = random.Random(20261008)


def pick(pool: list[str], exclude: set[str], n: int = 3, near: list[str] | None = None) -> list[str] | None:
    """n distinct options from `near` first (similar items), then `pool`, none in `exclude`."""
    ex = {norm(x) for x in exclude}
    out: list[str] = []
    seen: set[str] = set()
    for src in ([near] if near else []) + [pool]:
        cand = list(dict.fromkeys(src))
        rng.shuffle(cand)
        for c in cand:
            k = norm(c)
            if not c or k in ex or k in seen:
                continue
            seen.add(k)
            out.append(c)
            if len(out) == n:
                return out
    return None


def by_closeness(items: list[tuple[str, int]], sl: int, k: int = 14) -> list[str]:
    """The k names whose fame is closest to `sl` (similar difficulty distractors)."""
    return [n for n, _ in sorted(items, key=lambda x: abs(math.log(max(1, x[1])) - math.log(max(1, sl))))[:k]]


def fem(gender: str | None) -> bool:
    return gender in ("Q6581072", "Q1052281")


def century_he(y: int) -> str:
    if y <= 0:
        c = (abs(y) - 1) // 100 + 1
        return f"המאה ה-{c} לפנה\"ס"
    c = (y - 1) // 100 + 1
    return f"המאה ה-{c}"


def century_options(y: int) -> tuple[str, list[str]] | None:
    if y <= 0:
        return None
    c = (y - 1) // 100 + 1
    others = [x for x in (c - 2, c - 1, c + 1, c + 2) if 1 <= x <= 21]
    rng.shuffle(others)
    if len(others) < 3:
        return None
    return f"המאה ה-{c}", [f"המאה ה-{x}" for x in others[:3]]


# ---------------------------------------------------------------------------
# Shared indexes
# ---------------------------------------------------------------------------
CONTINENT_HE = {
    "Q46": "אירופה", "Q48": "אסיה", "Q15": "אפריקה", "Q49": "צפון אמריקה", "Q18": "דרום אמריקה",
    "Q538": "אוקיאניה", "Q55643": "אוקיאניה", "Q3960": "אוקיאניה", "Q51": "אנטארקטיקה",
}
EXCLUDED_COUNTRIES = {"Q219060", "Q40362", "Q23681", "Q23334", "Q23427", "Q907112", "Q34754", "Q1246"}

countries: dict[str, dict] = {}  # qid -> {he, sl, continent, pop, area, flag}


def multi(rows: list[dict], key="x", val="v") -> dict[str, set[str]]:
    d: dict[str, set[str]] = collections.defaultdict(set)
    for r in rows:
        if r.get(key) and r.get(val):
            d[r[key]].add(r[val])
    return d


def build_countries():
    cont = multi(load("country_continent"))
    for r in load("countries"):
        q = r["x"]
        if q in EXCLUDED_COUNTRIES:
            continue
        e = N.get(q)
        if not e:
            continue
        c = countries.setdefault(q, {"he": e.he, "sl": int(r.get("sl") or e.sl or 0), "flag": None, "pop": None, "area": None, "ent": e})
        conts = {CONTINENT_HE[x] for x in cont.get(q, set()) if x in CONTINENT_HE}
        c["continents"] = conts
        c["continent"] = next(iter(conts)) if len(conts) == 1 else None
        if r.get("flag") and not c["flag"]:
            c["flag"] = r["flag"]
        p = num(r.get("pop"))
        if p and (c["pop"] is None or p > c["pop"]):
            c["pop"] = p
        a = num(r.get("area"))
        if a and (c["area"] is None or a > c["area"]):
            c["area"] = a


def country_pool(near_continent: str | None = None, exclude: set[str] = frozenset()) -> tuple[list[str], list[str]]:
    pool = [c["he"] for q, c in countries.items() if q not in exclude]
    near = [c["he"] for q, c in countries.items() if q not in exclude and near_continent and near_continent in c.get("continents", set())]
    return pool, near


QS: list[Q] = []


def add(q: Q | None):
    if q and answers_ok(q):
        QS.append(q)


# ---------------------------------------------------------------------------
# Geography
# ---------------------------------------------------------------------------
def gen_geography():
    cap = multi(load("country_capital"))
    cur = multi(load("country_currency"))
    lang = multi(load("country_language"))
    border = multi(load("country_border"))
    high = multi(load("country_highest"))

    capitals = {q: N.get(next(iter(v))) for q, v in cap.items() if len(v) == 1 and q in countries}
    capitals = {q: e for q, e in capitals.items() if e}
    cap_names = [e.he for e in capitals.values()]

    for q, c in countries.items():
        name, sl = c["he"], c["sl"]
        ob = fame(sl, 320, 150)
        src = c["ent"].sources
        # capital
        e = capitals.get(q)
        if e:
            near = [capitals[o].he for o in capitals if o != q and c["continent"] and c["continent"] in countries[o].get("continents", set())]
            w = pick(cap_names, {e.he}, near=near)
            if w:
                add(Q(f"מהי עיר הבירה של {name}?", e.he, w, f"עיר הבירה של {name} היא {e.he}.", "geography", "capital", ob, src + e.sources[:1], key=q))
            pool, nearc = country_pool(c["continent"], {q})
            w = pick(pool, {name}, near=nearc)
            if w and e.he != name:
                add(Q(f"{e.he} היא עיר הבירה של איזו מדינה?", name, w, f"{e.he} היא עיר הבירה של {name}.", "geography", "capital_rev", min(1, ob + 0.05), src, key=q))
        # continent
        if c["continent"] and c["continent"] != "אנטארקטיקה":
            others = [x for x in ["אירופה", "אסיה", "אפריקה", "צפון אמריקה", "דרום אמריקה", "אוקיאניה"] if x != c["continent"]]
            rng.shuffle(others)
            add(Q(f"באיזו יבשת נמצאת {name}?", c["continent"], others[:3], f"{name} נמצאת ב{c['continent']}.", "geography", "continent", max(0, ob - 0.15), src, key=q))
        # flag (photo)
        img = photo(c["flag"], fit="contain")
        if img:
            pool, nearc = country_pool(c["continent"], {q})
            w = pick(pool, {name}, near=nearc)
            if w:
                add(Q("הדגל של איזו מדינה מופיע בתמונה?", name, w, f"זה הדגל של {name}.", "geography", "flag", ob, src, image=img, key=q))
        # currency
        if len(cur.get(q, ())) == 1:
            ce = N.get(next(iter(cur[q])))
            if ce:
                pool = [N.he(next(iter(v))) for o, v in cur.items() if o != q and len(v) == 1 and N.he(next(iter(v)))]
                w = pick([p for p in pool if p], {ce.he})
                if w:
                    add(Q(f"מהו המטבע של {name}?", ce.he, w, f"המטבע של {name} הוא {ce.he}.", "geography", "currency", min(1, ob + 0.1), src, key=q, volatile=True))
        # official language
        if len(lang.get(q, ())) == 1:
            le = N.get(next(iter(lang[q])))
            if le:
                pool = [N.he(x) for o, v in lang.items() if o != q for x in v]
                w = pick([p for p in pool if p], {le.he})
                if w:
                    add(Q(f"מהי השפה הרשמית של {name}?", le.he, w, f"השפה הרשמית של {name} היא {le.he}.", "geography", "language", min(1, ob + 0.05), src, key=q))
        # neighbour
        nb = [o for o in border.get(q, ()) if o in countries]
        if nb:
            o = max(nb, key=lambda x: countries[x]["sl"])
            notnb = [countries[x]["he"] for x in countries if x != q and x not in border.get(q, ()) and c["continent"] and c["continent"] in countries[x].get("continents", set())]
            w = pick(notnb, {countries[o]["he"], name})
            if w:
                add(Q(f"איזו מהמדינות הבאות גובלת עם {name}?", countries[o]["he"], w, f"{countries[o]['he']} גובלת עם {name}.", "geography", "border", min(1, ob + 0.15), src, key=q))
        # highest point
        if len(high.get(q, ())) == 1:
            he_ = N.get(next(iter(high[q])))
            if he_:
                pool = [N.he(next(iter(v))) for o, v in high.items() if o != q and len(v) == 1]
                w = pick([p for p in pool if p], {he_.he})
                if w:
                    add(Q(f"מהי הנקודה הגבוהה ביותר של {name}?", he_.he, w, f"הנקודה הגבוהה ביותר של {name} היא {he_.he}.", "geography", "highest", min(1, ob + 0.3), src + he_.sources[:1], key=q))

    # comparisons: population and area
    for metric, text, tpl in (("pop", "באיזו מהמדינות הבאות יש הכי הרבה תושבים?", "pop_cmp"), ("area", "איזו מהמדינות הבאות היא הגדולה ביותר בשטח?", "area_cmp")):
        vals = [(q, c) for q, c in countries.items() if c.get(metric)]
        vals.sort(key=lambda x: -x[1]["sl"])
        for i in range(min(160, len(vals))):
            group = [vals[i]]
            cand = vals[:]
            rng.shuffle(cand)
            for q2, c2 in cand:
                if len(group) == 4:
                    break
                if all(max(c2[metric], g[1][metric]) / max(1, min(c2[metric], g[1][metric])) >= 1.5 for g in group):
                    group.append((q2, c2))
            if len(group) < 4:
                continue
            best = max(group, key=lambda g: g[1][metric])
            ob = sum(fame(g[1]["sl"], 320, 150) for g in group) / 4 + 0.2
            add(Q(text, best[1]["he"], [g[1]["he"] for g in group if g is not best], f"מבין הארבע, {best[1]['he']} היא {'המאוכלסת' if metric == 'pop' else 'הגדולה'} ביותר.",
                  "geography", tpl, min(1, ob), best[1]["ent"].sources, key="|".join(sorted(g[0] for g in group)), volatile=metric == "pop"))

    # cities
    rows = load("cities")
    city_country: dict[str, set[str]] = collections.defaultdict(set)
    city_sl: dict[str, int] = {}
    for r in rows:
        city_country[r["x"]].add(r["c"])
        city_sl[r["x"]] = int(r.get("sl") or 0)
    country_names = {c["he"] for c in countries.values()}
    name_count = collections.Counter(N.he(x) for x in city_country)
    for x, cs in city_country.items():
        e = N.get(x)
        if not e or len(cs) != 1 or name_count[e.he] > 1 or e.he in country_names:
            continue
        cq = next(iter(cs))
        if cq not in countries or countries[cq]["he"] in e.he:
            continue
        c = countries[cq]
        pool, nearc = country_pool(c["continent"], {cq})
        w = pick(pool, {c["he"]}, near=nearc)
        if w:
            add(Q(f"באיזו מדינה נמצאת העיר {e.he}?", c["he"], w, f"{e.he} נמצאת ב{c['he']}." if not c["he"].startswith("ה") else f"העיר {e.he} נמצאת במדינה {c['he']}.",
                  "geography", "city_country", fame(city_sl[x], 250, 40), e.sources, key=x))

    # rivers, mountains, lakes, islands, deserts, volcanoes, waterfalls
    def places(name: str, typ: str, prefixes: tuple[str, ...], hi: float, lo: float, tpl: str):
        rows = load(name)
        cs: dict[str, set[str]] = collections.defaultdict(set)
        sl: dict[str, int] = {}
        img: dict[str, str] = {}
        for r in rows:
            if r.get("c"):
                cs[r["x"]].add(r["c"])
            sl[r["x"]] = int(r.get("sl") or 0)
            if r.get("img") and r["x"] not in img:
                img[r["x"]] = r["img"]
        out = {}
        for x in sl:
            e = N.get(x)
            if not e:
                continue
            label = e.he if e.he.startswith(prefixes) else f"{typ} {e.he}"
            out[x] = (e, label, {c for c in cs.get(x, set()) if c in countries}, sl[x], img.get(x))
        for x, (e, label, ccs, s, im) in out.items():
            if len(ccs) == 1:
                cq = next(iter(ccs))
                c = countries[cq]
                pool, nearc = country_pool(c["continent"], {cq})
                w = pick(pool, {c["he"]}, near=nearc)
                if w and c["he"] not in e.he:
                    add(Q(f"באיזו מדינה נמצא {label}?", c["he"], w, f"{label} נמצא ב{c['he']}." if not c["he"].startswith("ה") else f"{label} נמצא במדינה {c['he']}.",
                          "geography", tpl, fame(s, hi, lo), e.sources, key=x))
            elif len(ccs) > 1 and typ in ("הנהר",):
                cq = max(ccs, key=lambda k: countries[k]["sl"])
                c = countries[cq]
                notin = [countries[k]["he"] for k in countries if k not in ccs and c["continent"] and c["continent"] in countries[k].get("continents", set())]
                w = pick(notin, {c["he"]})
                if w:
                    add(Q(f"דרך איזו מהמדינות הבאות זורם {label}?", c["he"], w, f"{label} זורם בין היתר ב{c['he']}." if not c["he"].startswith("ה") else f"{label} זורם בין היתר במדינה {c['he']}.",
                          "geography", tpl + "_multi", fame(s, hi, lo) + 0.1, e.sources, key=x))
        return out

    rivers = places("rivers", "הנהר", ("נהר", "הנהר"), 150, 25, "river_country")
    places("mountains", "ההר", ("הר ", "ההר", "הרי"), 120, 20, "mountain_country")
    places("lakes", "האגם", ("אגם", "האגם", "ים "), 120, 25, "lake_country")
    places("islands", "האי", ("אי ", "האי", "איי"), 150, 30, "island_country")
    places("volcanoes", "הר הגעש", ("הר הגעש", "הר "), 100, 25, "volcano_country")
    places("deserts", "המדבר", ("מדבר", "המדבר"), 100, 20, "desert_country")
    places("waterfalls", "המפל", ("מפל", "המפלים", "מפלי"), 80, 20, "waterfall_country")

    # river mouths and longest river
    mouth = {}
    length = {}
    for r in load("rivers"):
        if r.get("mouth") and N.get(r["mouth"]):
            mouth.setdefault(r["x"], set()).add(r["mouth"])
        if num(r.get("len")):
            length[r["x"]] = max(length.get(r["x"], 0), num(r["len"]))
    mouth_names = [N.he(next(iter(v))) for v in mouth.values() if len(v) == 1]
    for x, ms in mouth.items():
        e = N.get(x)
        if not e or len(ms) != 1 or x not in rivers:
            continue
        me = N.get(next(iter(ms)))
        w = pick([m for m in mouth_names if m], {me.he})
        if w:
            add(Q(f"לאן נשפך {rivers[x][1]}?", me.he, w, f"{rivers[x][1]} נשפך אל {me.he}.", "geography", "river_mouth", fame(rivers[x][3], 150, 25) + 0.15, e.sources, key=x))
    lr = [(x, l) for x, l in length.items() if x in rivers and l > 300]
    lr.sort(key=lambda t: -rivers[t[0]][3])
    for i in range(min(60, len(lr))):
        group = [lr[i]]
        cand = lr[:]
        rng.shuffle(cand)
        for x2, l2 in cand:
            if len(group) == 4:
                break
            if all(max(l2, g[1]) / min(l2, g[1]) >= 1.3 for g in group):
                group.append((x2, l2))
        if len(group) == 4:
            best = max(group, key=lambda g: g[1])
            add(Q("איזה מהנהרות הבאים הוא הארוך ביותר?", rivers[best[0]][0].he, [rivers[g[0]][0].he for g in group if g is not best],
                  f"מבין הארבעה, {rivers[best[0]][0].he} הוא הארוך ביותר (כ-{int(best[1]):,} ק\"מ).", "geography", "river_longest", 0.45,
                  rivers[best[0]][0].sources, key="|".join(sorted(g[0] for g in group))))

    gen_landmarks()


LANDMARK_TYPE_HE = {
    "Q12518": "המגדל", "Q16560": "הארמון", "Q23413": "הטירה", "Q16970": "הכנסייה", "Q2977": "הקתדרלה", "Q32815": "המסגד",
    "Q44539": "המקדש", "Q33506": "המוזיאון", "Q12280": "הגשר", "Q4989906": "האנדרטה", "Q179700": "הפסל", "Q11303": "גורד השחקים",
    "Q1440300": "המגדל", "Q483110": "האצטדיון", "Q12570": "הגשר", "Q57821": "המבצר",
}


def gen_landmarks():
    rows = load("landmarks") + load("unesco")
    info: dict[str, dict] = {}
    for r in rows:
        x = r["x"]
        d = info.setdefault(x, {"cs": set(), "img": None, "sl": 0, "types": set(), "city": set(), "arch": set()})
        if r.get("c"):
            d["cs"].add(r["c"])
        if r.get("img") and not d["img"]:
            d["img"] = r["img"]
        d["sl"] = max(d["sl"], int(r.get("sl") or 0))
        if r.get("t"):
            d["types"].add(r["t"])
        if r.get("city"):
            d["city"].add(r["city"])
        if r.get("arch"):
            d["arch"].add(r["arch"])
    named = {x: (N.get(x), d) for x, d in info.items() if N.get(x)}
    names_by_type: dict[str, list[tuple[str, int]]] = collections.defaultdict(list)
    all_names = [(e.he, d["sl"]) for e, d in named.values()]
    for x, (e, d) in named.items():
        for t in d["types"]:
            names_by_type[t].append((e.he, d["sl"]))
    for x, (e, d) in named.items():
        ccs = {c for c in d["cs"] if c in countries}
        # photo: which landmark is this?
        img = photo(d["img"])
        if img and d["sl"] >= 40:
            same = [n for t in d["types"] for n, _ in names_by_type[t] if n != e.he]
            w = pick([n for n, _ in all_names], {e.he}, near=same or by_closeness(all_names, d["sl"]))
            if w:
                add(Q("איזה מקום מפורסם מופיע בתמונה?", e.he, w, f"זה {e.he}." + (f" הוא נמצא ב{countries[next(iter(ccs))]['he']}." if len(ccs) == 1 and not countries[next(iter(ccs))]['he'].startswith('ה') else ""),
                      "geography", "landmark_photo", fame(d["sl"], 160, 35), e.sources, image=img, key=x))
        if len(ccs) == 1:
            cq = next(iter(ccs))
            c = countries[cq]
            if c["he"] in e.he:
                continue
            pool, nearc = country_pool(c["continent"], {cq})
            w = pick(pool, {c["he"]}, near=nearc)
            if w:
                add(Q(f"באיזו מדינה נמצא האתר \"{e.he}\"?", c["he"], w, f"{e.he} נמצא ב{c['he']}." if not c["he"].startswith("ה") else f"{e.he} נמצא במדינה {c['he']}.",
                      "geography", "landmark_country", fame(d["sl"], 160, 30) + 0.05, e.sources, key=x))


# ---------------------------------------------------------------------------
# Nature
# ---------------------------------------------------------------------------
CLASS_HE = {
    "Q7377": "יונקים", "Q5113": "עופות", "Q10811": "זוחלים", "Q10908": "דו-חיים", "Q127282": "דגים", "Q25371": "דגים",
    "Q1390": "חרקים", "Q1358": "עכבישנים", "Q25326": "רכיכות", "Q25364": "סרטנאים",
}


def gen_nature():
    sp_sl: dict[str, int] = {}
    sp_img: dict[str, str] = {}
    for r in load("species"):
        sp_sl[r["x"]] = max(sp_sl.get(r["x"], 0), int(r.get("sl") or 0))
        if r.get("img") and r["x"] not in sp_img:
            sp_img[r["x"]] = r["img"]
    cls = multi(load("species_class"), "x", "cls")
    group: dict[str, str] = {}
    for x, cs in cls.items():
        g = {CLASS_HE[c] for c in cs if c in CLASS_HE}
        if len(g) == 1:
            group[x] = next(iter(g))
    names = {x: N.get(x) for x in sp_sl}
    names = {x: e for x, e in names.items() if e and " " not in e.he[:1]}
    by_group: dict[str, list[tuple[str, int]]] = collections.defaultdict(list)
    for x, e in names.items():
        if x in group:
            by_group[group[x]].append((e.he, sp_sl[x]))
    all_animals = [(e.he, sp_sl[x]) for x, e in names.items()]
    groups = ["יונקים", "עופות", "זוחלים", "דו-חיים", "דגים", "חרקים", "עכבישנים"]
    for x, e in names.items():
        s = sp_sl[x]
        g = group.get(x)
        img = photo(sp_img.get(x))
        if img and s >= 55:
            near = by_closeness(by_group.get(g, []), s, 16) if g else by_closeness(all_animals, s)
            w = pick([n for n, _ in all_animals], {e.he}, near=[n for n in near if n != e.he])
            if w:
                add(Q("איזה בעל חיים מופיע בתמונה?", e.he, w, f"זה {e.he}." + (f" הוא שייך ל{g}." if g else ""), "nature", "animal_photo", fame(s, 220, 50), e.sources, image=img, key=x))
        if g and s >= 45:
            w = [o for o in groups if o != g]
            rng.shuffle(w)
            add(Q(f"לאיזו קבוצה של בעלי חיים שייך ה{e.he}?" if not e.he.startswith("ה") else f"לאיזו קבוצה של בעלי חיים שייך {e.he}?", g, w[:3],
                  f"{e.he} שייך ל{g}.", "nature", "animal_class", fame(s, 220, 45) + 0.05, e.sources, key=x))
    # dog breeds
    breeds = {}
    for r in load("dog_breeds"):
        e = N.get(r["x"])
        if e:
            d = breeds.setdefault(r["x"], {"e": e, "sl": int(r.get("sl") or 0), "img": r.get("img"), "origin": set()})
            if r.get("origin"):
                d["origin"].add(r["origin"])
    bnames = [(d["e"].he, d["sl"]) for d in breeds.values()]
    for x, d in breeds.items():
        img = photo(d["img"])
        if img and d["sl"] >= 25:
            w = pick([n for n, _ in bnames], {d["e"].he}, near=by_closeness(bnames, d["sl"]))
            if w:
                add(Q("איזה גזע כלבים מופיע בתמונה?", d["e"].he, w, f"זה {d['e'].he}.", "nature", "dog_photo", fame(d["sl"], 90, 20), d["e"].sources, image=img, key=x))
        o = {c for c in d["origin"] if c in countries}
        if len(o) == 1:
            c = countries[next(iter(o))]
            pool, nearc = country_pool(c["continent"], o)
            w = pick(pool, {c["he"]}, near=nearc)
            if w and c["he"] not in d["e"].he:
                add(Q(f"מאיזו מדינה מגיע גזע הכלבים {d['e'].he}?", c["he"], w, f"{d['e'].he} הוא גזע כלבים שמקורו ב{c['he']}.", "nature", "dog_origin", fame(d["sl"], 90, 20) + 0.15, d["e"].sources, key=x))


# ---------------------------------------------------------------------------
# Science & space
# ---------------------------------------------------------------------------
def gen_science():
    els = {}
    for r in load("elements"):
        e = N.get(r["x"])
        n = num(r.get("num"))
        if not e or not n or n > 118:
            continue
        d = els.setdefault(r["x"], {"e": e, "num": int(n), "sym": set(), "disc": set(), "sl": int(r.get("sl") or 0)})
        if r.get("sym"):
            d["sym"].add(r["sym"])
        if r.get("disc"):
            d["disc"].add(r["disc"])
    syms = [next(iter(d["sym"])) for d in els.values() if len(d["sym"]) == 1]
    names = [d["e"].he for d in els.values()]
    for x, d in els.items():
        if len(d["sym"]) != 1:
            continue
        sym = next(iter(d["sym"]))
        ob = min(1.0, d["num"] / 90)
        near = [s for s in syms if s[0] == sym[0] and s != sym]
        w = pick(syms, {sym}, near=near)
        if w:
            add(Q(f"מהו הסמל הכימי של היסוד {d['e'].he}?", sym, w, f"הסמל של {d['e'].he} הוא {sym} (מספר אטומי {d['num']}).", "science", "element_symbol", ob, d["e"].sources, key=x))
        near_names = [o["e"].he for o in els.values() if abs(o["num"] - d["num"]) <= 12 and o is not d]
        w = pick(names, {d["e"].he}, near=near_names)
        if w:
            add(Q(f"איזה יסוד כימי מסומן בסמל {sym}?", d["e"].he, w, f"{sym} הוא הסמל של {d['e'].he}.", "science", "element_from_symbol", ob + 0.05, d["e"].sources, key=x))
        if d["num"] <= 36:
            opts = [str(d["num"] + k) for k in (-2, -1, 1, 2, 3) if 0 < d["num"] + k <= 118]
            rng.shuffle(opts)
            add(Q(f"מהו המספר האטומי של {d['e'].he}?", str(d["num"]), opts[:3], f"המספר האטומי של {d['e'].he} הוא {d['num']}: יש בגרעין שלו {d['num']} פרוטונים.", "science", "element_number", ob + 0.25, d["e"].sources, key=x))
        if len(d["disc"]) == 1 and N.get(next(iter(d["disc"]))):
            de = N.get(next(iter(d["disc"])))
            pool = [N.he(next(iter(o["disc"]))) for o in els.values() if len(o["disc"]) == 1 and o is not d]
            w = pick([p for p in pool if p], {de.he})
            if w:
                add(Q(f"מי גילה את היסוד {d['e'].he}?", de.he, w, f"את {d['e'].he} גילה {de.he}.", "science", "element_discoverer", ob + 0.35, d["e"].sources, key=x))

    # Nobel prizes
    NOBEL = {"Q38104": "פיזיקה", "Q44585": "כימיה", "Q80061": "רפואה", "Q37922": "ספרות", "Q35637": "שלום", "Q47170": "כלכלה"}
    fields: dict[str, set[str]] = collections.defaultdict(set)
    sl: dict[str, int] = {}
    for r in load("nobel"):
        fields[r["x"]].add(NOBEL.get(r["award"], ""))
        sl[r["x"]] = int(r.get("sl") or 0)
    gender = {r["x"]: r.get("gender") for r in load("people_facts")}
    for x, fs in fields.items():
        e = N.get(x)
        if not e or len(fs) != 1 or not sl.get(x) or sl[x] < 25:
            continue
        f = next(iter(fs))
        others = [o for o in NOBEL.values() if o != f]
        rng.shuffle(others)
        verb = "זכתה" if fem(gender.get(x)) else "זכה"
        cat = "science" if f in ("פיזיקה", "כימיה", "רפואה") else "people"
        add(Q(f"באיזה תחום {verb} {e.he} בפרס נובל?", f, others[:3], f"{e.he} {verb} בפרס נובל ל{f}.", cat, "nobel_field", fame(sl[x], 150, 25) + 0.1, e.sources, key=x))

    # inventors & discoverers (not elements)
    rows = load("rel_discoverer")
    disc = multi(rows, "x", "v")
    xsl = {r["x"]: int(r.get("sl") or 0) for r in rows}
    types = multi(rows, "x", "t")
    pool = [N.he(next(iter(v))) for v in disc.values() if len(v) == 1 and N.he(next(iter(v)))]
    for x, vs in disc.items():
        if len(vs) != 1 or "Q11344" in types.get(x, set()) or x in els:
            continue
        e, de = N.get(x), N.get(next(iter(vs)))
        if not e or not de or xsl.get(x, 0) < 25:
            continue
        # asteroids & minor planets are "discovered"; skip them (too obscure)
        if types.get(x, set()) & {"Q3863", "Q217526", "Q1022867", "Q6999"}:
            continue
        w = pick([p for p in pool if p], {de.he})
        if w:
            add(Q(f"מי גילה או המציא את {e.he}?", de.he, w, f"את {e.he} גילה או המציא {de.he}.", "science", "inventor", fame(xsl[x], 150, 25) + 0.1, e.sources, key=x))


PLANET_HE = {"Q308": "כוכב חמה", "Q313": "נוגה", "Q2": "כדור הארץ", "Q111": "מאדים", "Q319": "צדק", "Q193": "שבתאי", "Q324": "אורנוס", "Q332": "נפטון", "Q339": "פלוטו"}
PLANET_ORDER = ["Q308", "Q313", "Q2", "Q111", "Q319", "Q193", "Q324", "Q332"]
ORD_HE = ["הראשון", "השני", "השלישי", "הרביעי", "החמישי", "השישי", "השביעי", "השמיני"]


def gen_space():
    for r in load("moons"):
        e = N.get(r["x"])
        p = PLANET_HE.get(r.get("p"))
        if not e or not p or e.he in PLANET_HE.values():
            continue
        others = [v for k, v in PLANET_HE.items() if v != p and k not in ("Q2", "Q308", "Q313")]
        rng.shuffle(others)
        s = int(r.get("sl") or 0)
        add(Q(f"{e.he} הוא ירח של איזה כוכב לכת?", p, others[:3], f"{e.he} הוא אחד הירחים של {p}.", "space", "moon_planet", fame(s, 120, 20), e.sources, key=r["x"]))
        img = photo(r.get("img"))
        if img and s >= 60:
            pass
    for i, q in enumerate(PLANET_ORDER):
        others = [PLANET_HE[x] for x in PLANET_ORDER if x != q]
        rng.shuffle(others)
        add(Q(f"איזה כוכב לכת הוא {ORD_HE[i]} במרחקו מהשמש?", PLANET_HE[q], others[:3], f"{PLANET_HE[q]} הוא כוכב הלכת {ORD_HE[i]} מהשמש.", "space", "planet_order", 0.15 + 0.06 * abs(i - 2), [f"https://www.wikidata.org/wiki/{q}"], key=q))
    for r in load("planets"):
        img = photo(r.get("img"))
        q = r["x"]
        if img and q in PLANET_HE and q != "Q339":
            others = [PLANET_HE[x] for x in PLANET_ORDER if x != q]
            rng.shuffle(others)
            add(Q("איזה גרם שמיים מופיע בתמונה?", PLANET_HE[q], others[:3], f"זה {PLANET_HE[q]}.", "space", "planet_photo", 0.2, [f"https://www.wikidata.org/wiki/{q}"], image=img, key=q))
    cons = {r["x"]: N.get(r["x"]) for r in load("constellations")}
    cons = {k: v for k, v in cons.items() if v}
    cnames = [v.he for v in cons.values()]
    for r in load("stars"):
        e = N.get(r["x"])
        c = cons.get(r.get("con"))
        if not e or not c:
            continue
        w = pick(cnames, {c.he})
        if w:
            add(Q(f"באיזו קבוצת כוכבים נמצא הכוכב {e.he}?", c.he, w, f"הכוכב {e.he} נמצא בקבוצת הכוכבים {c.he}.", "space", "star_constellation", fame(int(r.get("sl") or 0), 90, 25) + 0.15, e.sources, key=r["x"]))
    # astronauts
    ac = multi(load("astronauts"), "x", "c")
    asl = {r["x"]: int(r.get("sl") or 0) for r in load("astronauts")}
    gender = {r["x"]: r.get("gender") for r in load("people_facts")}
    for x, cs in ac.items():
        e = N.get(x)
        cc = {c for c in cs if c in countries}
        if not e or len(cs) != 1 or len(cc) != 1 or asl.get(x, 0) < 20:
            continue
        c = countries[next(iter(cc))]
        pool, nearc = country_pool(None, cc)
        big = [countries[k]["he"] for k in ("Q30", "Q159", "Q148", "Q142", "Q183", "Q17", "Q16", "Q801", "Q668", "Q145", "Q38") if k in countries and k not in cc]
        w = pick(pool, {c["he"]}, near=big)
        f = fem(gender.get(x))
        if w:
            add(Q(f"מאיזו מדינה {'האסטרונאוטית' if f else 'האסטרונאוט'} {e.he}?", c["he"], w, f"{e.he} {'היא אסטרונאוטית' if f else 'הוא אסטרונאוט'} מ{c['he']}.", "space", "astronaut_country", fame(asl[x], 120, 20), e.sources, key=x))


# ---------------------------------------------------------------------------
# People
# ---------------------------------------------------------------------------
FIELD = {
    "פוליטיקה": {"Q82955", "Q372436", "Q193391", "Q30461", "Q2285706", "Q116", "Q48352", "Q12097", "Q10737834"},
    "משחק": {"Q33999", "Q10800557", "Q10798782", "Q2405480", "Q2259451", "Q948329"},
    "מוזיקה ושירה": {"Q177220", "Q639669", "Q488205", "Q753110", "Q855091", "Q2252262", "Q386854", "Q183945", "Q2643890"},
    "ספרות": {"Q36180", "Q6625963", "Q49757", "Q4853732", "Q214917", "Q482980", "Q18844224", "Q1930187"},
    "ציור ואמנות": {"Q1028181", "Q1281618", "Q483501", "Q11569986", "Q15296811", "Q33231"},
    "מדע": {"Q901", "Q169470", "Q593644", "Q170790", "Q864503", "Q11063", "Q1622272", "Q39631", "Q350979", "Q2919046", "Q520549"},
    "ספורט": {"Q937857", "Q3665646", "Q10833314", "Q10843402", "Q11513337", "Q2066131", "Q13382576", "Q11338576", "Q12299841", "Q13141064", "Q4009406", "Q19204627", "Q15117302", "Q10871364", "Q11774891", "Q13381376"},
    "פילוסופיה": {"Q4964182"},
    "הלחנה": {"Q36834", "Q1415090", "Q486748"},
    "בימוי קולנוע": {"Q2526255", "Q3455803"},
    "צבא": {"Q189290", "Q47064", "Q1402561"},
    "עסקים": {"Q43845", "Q131524", "Q484876"},
    "אדריכלות": {"Q42973"},
    "חקר החלל": {"Q11631"},
    "דת": {"Q250867", "Q1423891", "Q133485", "Q611644", "Q42603"},
    "חקר ומסעות": {"Q11900058"},
}
OCC_TO_FIELD = {o: f for f, os in FIELD.items() for o in os}


def gen_people():
    facts = {}
    for r in load("people_facts"):
        d = facts.setdefault(r["x"], {"gender": None, "birth": None, "death": None, "img": None})
        d["gender"] = d["gender"] or r.get("gender")
        d["birth"] = d["birth"] or year_of(r.get("birth"))
        d["death"] = d["death"] or year_of(r.get("death"))
        d["img"] = d["img"] or r.get("img")
    occ = multi(load("people_occupation"))
    ctry = multi(load("people_country"))
    born = multi(load("people_birthplace"))
    sl = {}
    israeli = set()
    for r in load("people"):
        sl[r["x"]] = max(sl.get(r["x"], 0), int(r.get("sl") or 0))
    for r in load("people_israel"):
        sl[r["x"]] = max(sl.get(r["x"], 0), int(r.get("sl") or 0))
        israeli.add(r["x"])
    names = {x: N.get(x) for x in sl}
    names = {x: e for x, e in names.items() if e and len(e.he.split()) <= 4}
    field_of = {}
    for x in names:
        fs = {OCC_TO_FIELD[o] for o in occ.get(x, ()) if o in OCC_TO_FIELD}
        if len(fs) == 1:
            field_of[x] = next(iter(fs))
    by_field_gender: dict[tuple[str, bool], list[tuple[str, int]]] = collections.defaultdict(list)
    for x, f in field_of.items():
        by_field_gender[(f, fem(facts.get(x, {}).get("gender")))].append((names[x].he, sl[x]))
    all_fields = list(FIELD)
    cities_he = {}
    for x, e in names.items():
        d = facts.get(x, {})
        f_ = fem(d.get("gender"))
        s = sl[x]
        isr = x in israeli
        cat = "israel" if isr else "people"
        hi, lo = (60, 8) if isr else (250, 70)
        ob = fame(s, hi, lo)
        # field
        if x in field_of:
            f = field_of[x]
            others = [o for o in all_fields if o != f]
            rng.shuffle(others)
            add(Q(f"במה {'התפרסמה' if f_ else 'התפרסם'} {e.he}?", f, others[:3], f"{e.he} {'מוכרת' if f_ else 'מוכר'} בזכות {f}.", cat, "person_field", ob, e.sources, key=x))
        # photo (only people who have died)
        img = photo(d.get("img"))
        if img and d.get("death") and s >= (25 if isr else 90) and x in field_of:
            same = [n for n, _ in by_field_gender[(field_of[x], f_)] if n != e.he]
            near = by_closeness([(n, ss) for n, ss in by_field_gender[(field_of[x], f_)] if n != e.he], s, 12)
            w = pick(same, {e.he}, near=near)
            if w:
                add(Q(f"מי {'מופיעה' if f_ else 'מופיע'} בתמונה?", e.he, w, f"{'זוהי' if f_ else 'זהו'} {e.he}.", cat, "person_photo", ob + 0.1, e.sources, image=img, key=x))
        # citizenship (one modern country)
        cs = ctry.get(x, set())
        if len(cs) == 1 and next(iter(cs)) in countries and not isr:
            c = countries[next(iter(cs))]
            alive = not d.get("death")
            subj = ("היא אזרחית" if alive else "הייתה אזרחית") if f_ else ("הוא אזרח" if alive else "היה אזרח")
            pool, nearc = country_pool(c["continent"], cs)
            w = pick(pool, {c["he"]}, near=nearc)
            if w:
                add(Q(f"{e.he} {subj} של איזו מדינה?", c["he"], w, f"{e.he} {subj} של {c['he']}.", cat, "person_country", ob + 0.05, e.sources, key=x))
        # birth city
        bp = born.get(x, set())
        if len(bp) == 1:
            be = N.get(next(iter(bp)))
            if be and be.sl >= 40:
                cities_he[x] = be.he
        # birth century (historical figures only)
        b = d.get("birth")
        if b and b < 1850 and s >= (20 if isr else 80):
            co = century_options(b)
            if co:
                add(Q(f"באיזו מאה {'נולדה' if f_ else 'נולד'} {e.he}?", co[0], co[1], f"{e.he} {'נולדה' if f_ else 'נולד'} בשנת {b}, כלומר ב{co[0]}.", cat if b > 0 else "history",
                      "person_century", ob + 0.1, e.sources, key=x))
    city_pool = list(set(cities_he.values()))
    for x, city in cities_he.items():
        e = names[x]
        f_ = fem(facts.get(x, {}).get("gender"))
        w = pick(city_pool, {city})
        if w and city not in e.he:
            add(Q(f"באיזו עיר {'נולדה' if f_ else 'נולד'} {e.he}?", city, w, f"{e.he} {'נולדה' if f_ else 'נולד'} ב{city}.", "israel" if x in israeli else "people", "person_birthplace",
                  fame(sl[x], 60, 8) + 0.2 if x in israeli else fame(sl[x], 250, 70) + 0.2, e.sources, key=x))


# ---------------------------------------------------------------------------
# "Who made it" relations: books, films, paintings, music, buildings, founders
# ---------------------------------------------------------------------------
LIT = {"Q7725634", "Q8261", "Q5185279", "Q25379", "Q571", "Q49084", "Q149537", "Q1279564", "Q699", "Q1667921", "Q12106333", "Q47461344"}
FILM = {"Q11424", "Q202866", "Q24862", "Q506240", "Q1261214", "Q229390", "Q20650540", "Q17517379"}
SERIES = {"Q5398426", "Q581714", "Q1259759", "Q526877"}
ART = {"Q3305213", "Q860861", "Q93184", "Q11060274", "Q125191", "Q1278452"}
MUSIC = {"Q7366", "Q134556", "Q482994", "Q105543609", "Q2188189", "Q1344", "Q9734", "Q207628", "Q2743", "Q169930", "Q208569"}
COMPANY = {"Q4830453", "Q891723", "Q6881511", "Q783794", "Q43229", "Q163740", "Q1058914", "Q18388277", "Q1589009"}


def relation(name: str, kinds: set[str] | None, cat: str, text, expl, tpl: str, hi: float, lo: float, bias: float = 0.0, img_text: str | None = None, israel_cat: str | None = None):
    rows = load(name)
    who = multi(rows, "x", "v")
    typ = multi(rows, "x", "t")
    sl, img = {}, {}
    for r in rows:
        sl[r["x"]] = max(sl.get(r["x"], 0), int(r.get("sl") or 0))
        if r.get("img") and r["x"] not in img:
            img[r["x"]] = r["img"]
    israelis = {r["x"] for r in load("people_israel")}
    pool_by_kind: dict[str, list[tuple[str, int]]] = collections.defaultdict(list)
    eligible = {}
    for x, vs in who.items():
        if kinds and not (typ.get(x, set()) & kinds):
            continue
        if len(vs) != 1:
            continue
        e, ve = N.get(x), N.get(next(iter(vs)))
        if not e or not ve or e.he == ve.he or ve.he in e.he:
            continue
        eligible[x] = (e, ve)
        k = next(iter(sorted(typ.get(x, set()) & kinds))) if kinds else "_"
        pool_by_kind[k].append((ve.he, ve.sl))
    makers = [v for vs in pool_by_kind.values() for v in vs]
    makers_dedup = list({n: s for n, s in makers}.items())
    for x, (e, ve) in eligible.items():
        k = next(iter(sorted(typ.get(x, set()) & kinds))) if kinds else "_"
        near = by_closeness(list({n: s for n, s in pool_by_kind[k]}.items()), ve.sl, 14)
        w = pick([n for n, _ in makers_dedup], {ve.he}, near=[n for n in near if n != ve.he])
        if not w:
            continue
        c = israel_cat if israel_cat and next(iter(who[x])) in israelis else cat
        ob = fame(sl[x], hi, lo) + bias
        add(Q(text(e.he), ve.he, w, expl(e.he, ve.he), c, tpl, ob, e.sources + ve.sources[:1], key=x))
        if img_text:
            im = photo(img.get(x), fit="contain")
            if im and sl[x] >= 30:
                add(Q(img_text, ve.he, w, expl(e.he, ve.he), c, tpl + "_photo", ob + 0.1, e.sources, image=im, key=x))
    return eligible


def gen_relations():
    relation("rel_author", LIT, "culture", lambda w: f"מי כתב את \"{w}\"?", lambda w, a: f"\"{w}\" נכתב על ידי {a}.", "author", 120, 12, israel_cat="israel")
    relation("rel_director", FILM | SERIES, "screen", lambda w: f"מי ביים את הסרט \"{w}\"?", lambda w, a: f"\"{w}\" בוים על ידי {a}.", "director", 120, 15)
    relation("rel_creator", ART, "culture", lambda w: f"מי יצר את \"{w}\"?", lambda w, a: f"\"{w}\" נוצר על ידי {a}.", "artist", 100, 10,
             img_text="מי האמן שיצר את היצירה שבתמונה?")
    relation("rel_composer", MUSIC, "music", lambda w: f"מי הלחין את \"{w}\"?", lambda w, a: f"\"{w}\" הולחן על ידי {a}.", "composer", 80, 8, israel_cat="israel")
    relation("rel_lyricist", MUSIC, "music", lambda w: f"מי כתב את המילים לשיר \"{w}\"?", lambda w, a: f"המילים ל\"{w}\" נכתבו על ידי {a}.", "lyricist", 40, 5, israel_cat="israel")
    relation("rel_performer", MUSIC, "music", lambda w: f"מי ביצע את \"{w}\"?", lambda w, a: f"\"{w}\" בוצע על ידי {a}.", "performer", 80, 12)
    relation("rel_architect", None, "culture", lambda w: f"מי תכנן את \"{w}\"?", lambda w, a: f"\"{w}\" תוכנן על ידי {a}.", "architect", 120, 12, bias=0.15)
    relation("rel_founder", COMPANY, "people", lambda w: f"מי ייסד את \"{w}\"?", lambda w, a: f"\"{w}\" נוסד על ידי {a}.", "founder", 150, 20)

    # paintings by photo: "which famous artwork is this?"
    rows = load("rel_creator")
    typ = multi(rows, "x", "t")
    seen = {}
    for r in rows:
        if r["x"] in seen or not (typ.get(r["x"], set()) & {"Q3305213"}):
            continue
        e = N.get(r["x"])
        if e and r.get("img"):
            seen[r["x"]] = (e, int(r.get("sl") or 0), r["img"])
    pool = [(e.he, s) for e, s, _ in seen.values()]
    for x, (e, s, im) in seen.items():
        img = photo(im, fit="contain")
        if img and s >= 30:
            w = pick([n for n, _ in pool], {e.he}, near=by_closeness(pool, s))
            if w:
                add(Q("איזו יצירת אמנות מפורסמת מופיעה בתמונה?", e.he, w, f"זו \"{e.he}\".", "culture", "artwork_photo", fame(s, 100, 25), e.sources, image=img, key=x))

    # where did a film / dish / cheese come from
    rows = load("rel_origin")
    typ = multi(rows, "x", "t")
    org = multi(rows, "x", "v")
    sl = {r["x"]: int(r.get("sl") or 0) for r in rows}
    for x, os_ in org.items():
        ts = typ.get(x, set())
        cc = {c for c in os_ if c in countries}
        if len(os_) != 1 or len(cc) != 1:
            continue
        e = N.get(x)
        if not e:
            continue
        c = countries[next(iter(cc))]
        if c["he"] in e.he:
            continue
        if ts & SERIES and sl.get(x, 0) >= 25:
            text, cat, tpl = f"מאיזו מדינה הגיעה סדרת הטלוויזיה \"{e.he}\"?", "screen", "series_origin"
        elif ts & {"Q10943"}:
            text, cat, tpl = f"מאיזו מדינה מגיעה הגבינה {e.he}?", "food", "cheese_origin"
        elif ts & {"Q2095", "Q746549", "Q1778821", "Q19861951"}:
            text, cat, tpl = f"מאיזו מדינה מגיע המאכל {e.he}?", "food", "dish_origin"
        elif ts & {"Q2471", "Q154", "Q282", "Q44", "Q2329", "Q40050"}:
            text, cat, tpl = f"מאיזו מדינה מגיע המשקה {e.he}?", "food", "drink_origin"
        else:
            continue
        pool, nearc = country_pool(c["continent"], cc)
        w = pick(pool, {c["he"]}, near=nearc)
        if w:
            add(Q(text, c["he"], w, f"{e.he} {'מגיע' if tpl != 'cheese_origin' else 'מגיעה'} מ{c['he']}." if not c["he"].startswith("ה") else f"מקורו של {e.he} במדינה {c['he']}.",
                  cat, tpl, fame(sl.get(x, 0), 120, 12), e.sources, key=x))


# ---------------------------------------------------------------------------
# History & offices
# ---------------------------------------------------------------------------
OFFICE_HE = {
    "us_president": ("נשיא ארצות הברית", "history"), "il_pm": ("ראש ממשלת ישראל", "israel"), "il_president": ("נשיא מדינת ישראל", "israel"),
    "uk_pm": ("ראש ממשלת בריטניה", "history"), "fr_president": ("נשיא צרפת", "history"), "de_chancellor": ("קנצלר גרמניה", "history"),
    "un_sg": ("מזכ\"ל האו\"ם", "history"), "pope": ("האפיפיור", "history"), "ru_president": ("נשיא רוסיה", "history"),
    "il_chief_of_staff": ("הרמטכ\"ל", "israel"),
}


def gen_history():
    for name, typ, tpl in (("wars", "המלחמה", "war_century"), ("events", "האירוע", "event_century")):
        rows = load(name)
        start, sl = {}, {}
        for r in rows:
            y = year_of(r.get("start")) or year_of(r.get("date"))
            if y:
                start[r["x"]] = min(start.get(r["x"], 9999), y)
            sl[r["x"]] = max(sl.get(r["x"], 0), int(r.get("sl") or 0))
        for x, y in start.items():
            e = N.get(x)
            if not e or y < 1 or y > 2010:
                continue
            co = century_options(y)
            if not co:
                continue
            verb = "התחילה" if name == "wars" else "התרחש"
            add(Q(f"באיזו מאה {verb} {e.he}?", co[0], co[1], f"{e.he} {verb} בשנת {y}, ב{co[0]}.", "history", tpl, fame(sl[x], 150, 30), e.sources, key=x))

    resolved = json.loads((DATA / "_offices_resolved.json").read_text()) if (DATA / "_offices_resolved.json").exists() else {}
    by_office = collections.defaultdict(list)
    for r in load("offices"):
        y = r.get("start")
        if r.get("office") and r.get("x") and y:
            by_office[r["office"]].append((y, r["x"], r.get("end")))
    gender = {r["x"]: r.get("gender") for r in load("people_facts")}
    for key, qid in resolved.items():
        if not qid or key not in OFFICE_HE or qid not in by_office:
            continue
        title, cat = OFFICE_HE[key]
        terms = sorted(by_office[qid])
        seq = []
        for _, x, _ in terms:
            if not seq or seq[-1] != x:
                seq.append(x)
        seq = [x for x in seq if N.get(x)]
        if len(seq) < 5:
            continue
        names = [N.he(x) for x in seq]
        runs = collections.Counter(seq)
        first = seq[0]
        w = pick(names, {N.he(first)}, near=names[1:6])
        if w:
            add(Q(f"מי {'הייתה' if fem(gender.get(first)) else 'היה'} {title} הראשון?", N.he(first), w, f"{N.he(first)} היה {title} הראשון.", cat, "office_first", 0.15, N.get(first).sources, key=key))
        for i in range(1, len(seq)):
            prev, cur = seq[i - 1], seq[i]
            if runs[prev] != 1 or runs[cur] != 1:
                continue
            ce, pe = N.get(cur), N.get(prev)
            near = [N.he(x) for x in seq[max(0, i - 4): i + 4] if x not in (cur, prev)]
            w = pick(names, {ce.he, pe.he}, near=near)
            if w:
                add(Q(f"מי {'כיהנה' if fem(gender.get(cur)) else 'כיהן'} כ{title} מיד אחרי {pe.he}?", ce.he, w, f"אחרי {pe.he} {'כיהנה' if fem(gender.get(cur)) else 'כיהן'} כ{title} {ce.he}.", cat, "office_after",
                      0.35 + 0.25 * (1 - i / len(seq)), ce.sources, key=f"{key}:{cur}"))


# ---------------------------------------------------------------------------
# Israel, sport, food, music extras
# ---------------------------------------------------------------------------
DISTRICT_HE = {}


def gen_israel():
    places = {}
    for r in load("israel_places"):
        e = N.get(r["x"])
        if not e:
            continue
        d = places.setdefault(r["x"], {"e": e, "pop": None, "sl": int(r.get("sl") or 0), "img": r.get("img")})
        p = num(r.get("pop"))
        if p and (d["pop"] is None or p > d["pop"]):
            d["pop"] = p
    dist = multi(load("israel_district"), "x", "d")
    dnames = {}
    for x, ds in dist.items():
        hs = {N.he(d) for d in ds if N.he(d) and N.he(d).startswith("מחוז")}
        if len(hs) == 1:
            dnames[x] = next(iter(hs))
    all_d = sorted(set(dnames.values()))
    for x, dn in dnames.items():
        if x not in places or len(all_d) < 4:
            continue
        e = places[x]["e"]
        others = [d for d in all_d if d != dn]
        rng.shuffle(others)
        add(Q(f"באיזה מחוז נמצא היישוב {e.he}?", dn, others[:3], f"{e.he} נמצא ב{dn}.", "israel", "district", fame(places[x]["sl"], 60, 8), e.sources, key=x))
    big = [(x, d) for x, d in places.items() if d["pop"] and d["pop"] >= 20000]
    big.sort(key=lambda t: -t[1]["sl"])
    for i in range(min(60, len(big))):
        group = [big[i]]
        cand = big[:]
        rng.shuffle(cand)
        for x2, d2 in cand:
            if len(group) == 4:
                break
            if all(max(d2["pop"], g[1]["pop"]) / min(d2["pop"], g[1]["pop"]) >= 1.35 for g in group):
                group.append((x2, d2))
        if len(group) == 4:
            best = max(group, key=lambda g: g[1]["pop"])
            add(Q("באיזו מהערים הבאות גרים הכי הרבה תושבים?", best[1]["e"].he, [g[1]["e"].he for g in group if g is not best],
                  f"מבין הארבע, ב{best[1]['e'].he} גרים הכי הרבה תושבים.", "israel", "city_pop_cmp", 0.4, best[1]["e"].sources,
                  key="|".join(sorted(g[0] for g in group)), volatile=True))
    sites = {}
    for r in load("israel_sites"):
        e = N.get(r["x"])
        if e and r.get("img") and r["x"] not in sites:
            sites[r["x"]] = (e, int(r.get("sl") or 0), r["img"])
    for x, d in places.items():
        if d["img"] and d["sl"] >= 15 and x not in sites:
            sites[x] = (d["e"], d["sl"], d["img"])
    pool = [(e.he, s) for e, s, _ in sites.values()]
    for x, (e, s, im) in sites.items():
        img = photo(im)
        if img and s >= 12:
            w = pick([n for n, _ in pool], {e.he}, near=by_closeness(pool, s))
            if w:
                add(Q("איזה מקום בישראל מופיע בתמונה?", e.he, w, f"זה {e.he}.", "israel", "israel_photo", fame(s, 60, 10), e.sources, image=img, key=x))


def gen_sport_food_music():
    for r in load("olympics"):
        e = N.get(r["x"])
        city = N.get(r.get("city"))
        if not e or not city or city.he in e.he:
            continue
    oly = {}
    for r in load("olympics"):
        e = N.get(r["x"])
        if e and r.get("city") and N.get(r["city"]):
            oly.setdefault(r["x"], (e, set()))[1].add(N.he(r["city"]))
    cities = sorted({c for _, cs in oly.values() for c in cs})
    for x, (e, cs) in oly.items():
        if len(cs) != 1:
            continue
        c = next(iter(cs))
        if c in e.he:
            continue
        w = pick(cities, {c})
        if w:
            add(Q(f"באיזו עיר נערכה {e.he}?", c, w, f"{e.he} נערכה ב{c}.", "sport", "olympics_city", 0.35, e.sources, key=x))
    for r in load("sports"):
        e = N.get(r["x"])
        n_ = num(r.get("players"))
        if e and n_ and 1 <= n_ <= 15:
            n_ = int(n_)
            opts = sorted({str(n_ + k) for k in (-2, -1, 1, 2, 3, 4) if n_ + k >= 1} - {str(n_)})
            rng.shuffle(opts)
            add(Q(f"כמה שחקנים יש בכל קבוצה על המגרש ב{e.he}?", str(n_), opts[:3], f"ב{e.he} יש {n_} שחקנים בכל קבוצה.", "sport", "sport_players", fame(int(r.get("sl") or 0), 150, 25) + 0.1, e.sources, key=r["x"]))
    sp = {}
    for r in load("sports"):
        e = N.get(r["x"])
        if e and r.get("img") and r["x"] not in sp:
            sp[r["x"]] = (e, int(r.get("sl") or 0), r["img"])
    pool = [(e.he, s) for e, s, _ in sp.values()]
    for x, (e, s, im) in sp.items():
        img = photo(im)
        if img and s >= 40:
            w = pick([n for n, _ in pool], {e.he}, near=by_closeness(pool, s))
            if w:
                add(Q("איזה ענף ספורט מופיע בתמונה?", e.he, w, f"זה {e.he}.", "sport", "sport_photo", fame(s, 160, 40), e.sources, image=img, key=x))
    # dishes & foods
    for name, text, tpl, minsl in (("dishes", "איזה מאכל מופיע בתמונה?", "dish_photo", 20), ("foods", "מה מופיע בתמונה?", "food_photo", 30)):
        items = {}
        for r in load(name):
            e = N.get(r["x"])
            if e and r.get("img") and r["x"] not in items:
                items[r["x"]] = (e, int(r.get("sl") or 0), r["img"])
        pool = [(e.he, s) for e, s, _ in items.values()]
        for x, (e, s, im) in items.items():
            img = photo(im)
            if img and s >= minsl:
                w = pick([n for n, _ in pool], {e.he}, near=by_closeness(pool, s))
                if w:
                    add(Q(text, e.he, w, f"זה {e.he}.", "food", tpl, fame(s, 120, 15), e.sources, image=img, key=x))
    dish_origin = multi(load("dishes"), "x", "origin")
    dsl = {r["x"]: int(r.get("sl") or 0) for r in load("dishes")}
    for x, os_ in dish_origin.items():
        cc = {c for c in os_ if c in countries}
        e = N.get(x)
        if not e or len(os_) != 1 or len(cc) != 1:
            continue
        c = countries[next(iter(cc))]
        if c["he"] in e.he:
            continue
        pool, nearc = country_pool(c["continent"], cc)
        w = pick(pool, {c["he"]}, near=nearc)
        if w:
            add(Q(f"מאיזו מדינה מגיע המאכל {e.he}?", c["he"], w, f"{e.he} {'מגיע' } מ{c['he']}." if not c["he"].startswith("ה") else f"מקורו של {e.he} במדינה {c['he']}.",
                  "food", "dish_origin", fame(dsl.get(x, 0), 120, 12), e.sources, key=x))
    # instruments
    items = {}
    for r in load("instruments"):
        e = N.get(r["x"])
        if e and r.get("img") and r["x"] not in items:
            items[r["x"]] = (e, int(r.get("sl") or 0), r["img"])
    pool = [(e.he, s) for e, s, _ in items.values()]
    for x, (e, s, im) in items.items():
        img = photo(im, fit="contain")
        if img and s >= 25:
            w = pick([n for n, _ in pool], {e.he}, near=by_closeness(pool, s))
            if w:
                add(Q("איזה כלי נגינה מופיע בתמונה?", e.he, w, f"זה {e.he}.", "music", "instrument_photo", fame(s, 120, 25), e.sources, image=img, key=x))
    # eurovision host city
    ev = {}
    for r in load("eurovision"):
        e = N.get(r["x"])
        if e and r.get("city") and N.get(r["city"]):
            ev.setdefault(r["x"], (e, set()))[1].add(N.he(r["city"]))
    cities = sorted({c for _, cs in ev.values() for c in cs})
    for x, (e, cs) in ev.items():
        if len(cs) == 1:
            c = next(iter(cs))
            w = pick(cities, {c})
            if w and c not in e.he:
                add(Q(f"באיזו עיר נערכה {e.he}?", c, w, f"{e.he} נערכה ב{c}.", "music", "eurovision_city", 0.4, e.sources, key=x))


# ---------------------------------------------------------------------------
# Output
# ---------------------------------------------------------------------------
CAPS = {
    "person_field": 1400, "person_country": 900, "person_birthplace": 500, "person_photo": 600, "person_century": 250,
    "city_country": 900, "author": 900, "director": 700, "performer": 600, "animal_photo": 700, "animal_class": 500,
    "landmark_country": 600, "landmark_photo": 600, "inventor": 250, "founder": 250, "food_photo": 300, "dish_photo": 300,
}
YEAR_TEMPLATES: set[str] = set()


def main():
    global DATA, N
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="data/general")
    ap.add_argument("--out", default="content/general")
    args = ap.parse_args()
    DATA = Path(args.data)
    N = Names()
    for c in load("commons"):
        COMMONS[c["file"]] = c
    build_countries()
    steps = [gen_geography, gen_nature, gen_science, gen_space, gen_people, gen_relations, gen_history, gen_israel, gen_sport_food_music]
    for s in steps:
        before = len(QS)
        try:
            s()
        except Exception as ex:  # keep going: one broken dataset must not sink the whole bank
            import traceback
            traceback.print_exc()
            print(f"!! {s.__name__} failed: {ex}")
        print(f"{s.__name__}: +{len(QS) - before}")

    # de-dupe: same text+answer, then same text with different answers (ambiguous)
    seen, good = set(), []
    for q in QS:
        k = (norm(q.text), norm(q.correct))
        if k in seen:
            continue
        seen.add(k)
        good.append(q)
    by_text = collections.defaultdict(set)
    for q in good:
        if q.image is None:
            by_text[norm(q.text)].add(norm(q.correct))
    amb = {t for t, a in by_text.items() if len(a) > 1}
    good = [q for q in good if q.image is not None or norm(q.text) not in amb]

    # per-template caps, best-known first
    by_tpl = collections.defaultdict(list)
    for q in good:
        by_tpl[q.template].append(q)
    final = []
    for tpl, qs in by_tpl.items():
        qs.sort(key=lambda q: q.obscurity)
        cap = CAPS.get(tpl)
        final.extend(qs[:cap] if cap else qs)

    LEVELS = [("easy", 0.22), ("medium", 0.3), ("hard", 0.26), ("expert", 0.15), ("legendary", 0.07)]
    rows = []
    by_cat = collections.defaultdict(list)
    for q in final:
        by_cat[q.category].append(q)
    for cat, qs in by_cat.items():
        qs.sort(key=lambda q: (min(1.0, max(0.0, q.obscurity)), q.key))
        n, i, acc = len(qs), 0, 0.0
        for lvl, share in LEVELS:
            acc += share
            upto = int(round(acc * n))
            while i < min(upto, n):
                q = qs[i]
                h = hashlib.sha1(f"gk|{q.template}|{q.key or q.text}|{q.correct}".encode()).hexdigest()
                rows.append({
                    "id": f"q_{h[:16]}",
                    "text_he": q.text,
                    "answers_he": [q.correct, *q.wrong],
                    "explanation_he": q.explanation,
                    "category": q.category,
                    "topic": q.template,
                    "difficulty": lvl,
                    "obscurity": round(min(1.0, max(0.0, q.obscurity)), 4),
                    "tags": q.tags,
                    "template": q.template,
                    "source_urls": q.sources[:3],
                    "verified_by": "wikidata",
                    "volatile": q.volatile,
                    "generator": GEN,
                    "image": q.image,
                })
                i += 1
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    rows.sort(key=lambda r: r["id"])
    ids = collections.Counter(r["id"] for r in rows)
    rows = [r for r in rows if ids[r["id"]] == 1]
    with (out / "questions.jsonl").open("w", encoding="utf-8") as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    report = {
        "generator": GEN,
        "total": len(rows),
        "with_image": sum(1 for r in rows if r["image"]),
        "by_category": collections.Counter(r["category"] for r in rows).most_common(),
        "by_template": collections.Counter(r["template"] for r in rows).most_common(),
        "by_difficulty": collections.Counter(r["difficulty"] for r in rows).most_common(),
    }
    (out / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=1), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
