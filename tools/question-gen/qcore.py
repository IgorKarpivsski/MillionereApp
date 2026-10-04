"""
Question generator: builds Hebrew multiple-choice football questions from
open, verifiable data.

Sources (both CC0 / public domain):
  * Wikidata  — data/wikidata/*.json (fetched by fetch-wikidata*.mjs)
  * openfootball — match data, cloned to --openfootball DIR

Rules that keep the bank trustworthy:
  * Names come from Hebrew Wikipedia article titles, never free text.
  * A question is only emitted when its single correct answer is certain
    and every distractor is certainly wrong (checked against the full data).
  * Facts that two sources cover (World Cup, league champions) must agree,
    or the fact is dropped.
  * Facts that change over time are flagged `volatile` with a review date.
  * Every question carries its source links.

Usage:
  python3 tools/question-gen/generate.py --openfootball /path/to/openfootball \
      --out content/questions
"""
from __future__ import annotations

import argparse
import collections
import hashlib
import json
import random
import re
import unicodedata
from dataclasses import dataclass, field
from pathlib import Path

GEN_VERSION = "2026.10.1"
DATA = Path("data/wikidata")
HEB = re.compile(r"[֐-׿]")


# ---------------------------------------------------------------------------
# Loading
# ---------------------------------------------------------------------------
def load(name: str):
    return json.loads((DATA / f"{name}.json").read_text(encoding="utf-8"))


def year_of(s: str | None) -> int | None:
    if not s:
        return None
    m = re.match(r"^-?(\d{4})", s)
    return int(m.group(1)) if m else None


@dataclass
class Entity:
    qid: str
    he: str | None = None          # display name (from Hebrew Wikipedia title)
    he_title: str | None = None    # raw Hebrew Wikipedia title (for links)
    en_title: str | None = None
    sitelinks: int = 0

    @property
    def he_url(self) -> str | None:
        return f"https://he.wikipedia.org/wiki/{self.he_title.replace(' ', '_')}" if self.he_title else None

    @property
    def wd_url(self) -> str:
        return f"https://www.wikidata.org/wiki/{self.qid}"


def be(phrase: str) -> str:
    """Hebrew 'in' + phrase: 'ב' absorbs a leading definite article (ה)."""
    return "ב" + (phrase[1:] if phrase.startswith("ה") and not phrase.startswith("הפועל") else phrase)


def le(name: str) -> str:
    """Hebrew 'to/and' prefix: no hyphen before Hebrew words, hyphen before digits/Latin."""
    return ("ל-" if re.match(r"^[0-9A-Za-z]", name) else "ל") + name


def club_ref(ent) -> str:
    """How to name a club inside a question: disambiguate names that are also places."""
    if ent.he_title and "(" in ent.he_title and not ent.he.startswith(("מכבי", "הפועל", "בית\"ר", "בני", "עירוני")):
        return f"מועדון הכדורגל {ent.he}"
    return ent.he


def clean_he_title(title: str) -> str:
    t = re.sub(r"\s*\([^)]*\)\s*$", "", title).strip()
    t = re.sub(r"^מועדון הכדורגל\s+", "", t)
    return t


def national_display(title: str) -> str:
    """'נבחרת ברזיל בכדורגל' -> 'ברזיל'."""
    t = clean_he_title(title)
    t = re.sub(r"\s+בכדורגל$", "", t)
    t = re.sub(r"^נבחרת\s+", "", t)
    return t


class Names:
    def __init__(self):
        self.e: dict[str, Entity] = {}
        for f in ("wiki_titles", "wiki_titles_extra"):
            p = DATA / f"{f}.json"
            if not p.exists():
                continue
            for r in json.loads(p.read_text(encoding="utf-8")):
                ent = self.e.setdefault(r["e"], Entity(r["e"]))
                if r.get("he") and HEB.search(r["he"]):
                    ent.he_title = r["he"]
                    ent.he = clean_he_title(r["he"])
                if r.get("en"):
                    ent.en_title = r["en"]
                if r.get("sl"):
                    ent.sitelinks = max(ent.sitelinks, int(r["sl"]))

    def get(self, qid: str | None) -> Entity | None:
        if not qid:
            return None
        ent = self.e.get(qid)
        return ent if ent and ent.he else None

    def he(self, qid: str | None) -> str | None:
        ent = self.get(qid)
        return ent.he if ent else None


# ---------------------------------------------------------------------------
# Question model
# ---------------------------------------------------------------------------
LEVELS = ["easy", "medium", "hard", "expert", "legendary"]


@dataclass
class Q:
    text: str
    correct: str
    wrong: list[str]
    explanation: str
    category: str
    topic: str
    template: str
    obscurity: float            # 0 = everyone knows, 1 = only experts
    sources: list[str]
    tags: dict = field(default_factory=dict)
    volatile: bool = False
    verified_by: str = "wikidata"
    key: str = ""               # dedupe key (same fact asked twice)

    def answers_ok(self) -> bool:
        opts = [self.correct, *self.wrong]
        norm = [normalize_he(o) for o in opts]
        if len(opts) != 4 or len(set(norm)) != 4:
            return False
        if any(not o or len(o) > 60 for o in opts):
            return False
        # The answer must not be given away by the question text.
        if normalize_he(self.correct) and normalize_he(self.correct) in normalize_he(self.text) and not self.correct.isdigit():
            return False
        return True


def normalize_he(s: str) -> str:
    s = unicodedata.normalize("NFKC", s or "")
    s = re.sub(r"[\"'׳״`\-–—.,()]", "", s)
    return re.sub(r"\s+", " ", s).strip().lower()


def stable_id(q: Q) -> str:
    h = hashlib.sha1(f"{q.template}|{q.key or q.text}|{q.correct}".encode()).hexdigest()
    return f"q_{h[:16]}"


def pick_distractors(rng: random.Random, pool: list[str], exclude: set[str], n: int = 3) -> list[str] | None:
    ex = {normalize_he(x) for x in exclude}
    seen: set[str] = set()
    out: list[str] = []
    cand = list(dict.fromkeys(pool))
    rng.shuffle(cand)
    for c in cand:
        k = normalize_he(c)
        if not c or k in ex or k in seen:
            continue
        seen.add(k)
        out.append(c)
        if len(out) == n:
            return out
    return None


def numeric_distractors(rng: random.Random, value: int, spread: list[int], lo: int | None = None, hi: int | None = None) -> list[str]:
    opts = set()
    deltas = spread[:]
    rng.shuffle(deltas)
    for d in deltas:
        v = value + d
        if v == value or (lo is not None and v < lo) or (hi is not None and v > hi):
            continue
        opts.add(v)
        if len(opts) == 3:
            break
    return [str(v) for v in sorted(opts)]


def fame_obscurity(sitelinks: int, ref_high: int = 150, ref_low: int = 10) -> float:
    """Map Wikipedia language count to 0..1 obscurity (log scale)."""
    import math
    s = max(1, sitelinks)
    x = (math.log(ref_high) - math.log(s)) / (math.log(ref_high) - math.log(ref_low))
    return min(1.0, max(0.0, x))


def recency_obscurity(year: int | None, now: int = 2026) -> float:
    if year is None:
        return 0.5
    age = max(0, now - year)
    return min(1.0, age / 60)
