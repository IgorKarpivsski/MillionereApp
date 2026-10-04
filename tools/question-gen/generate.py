"""Builds the question bank. See qcore.py for the rules every question follows."""
from __future__ import annotations

import argparse
import collections
import json
import random
from pathlib import Path

import gen_competitions
import gen_openfootball
import gen_people
from qcore import GEN_VERSION, HEB, LEVELS, Names, Q, normalize_he, stable_id

# Upper bounds per template so no single question type dominates the bank.
# Separate caps for Israeli football so world football doesn't crowd it out.
CAPS = {
    "player:club": 1900, "club:which_player": 1500, "player:national_team": 1300,
    "player:position": 1000, "player:birth_year": 800, "club:founded": 550,
    "club:city": 450, "club:stadium": 400,
}
CAPS_ISRAEL = {
    "player:club": 1100, "club:which_player": 900, "player:position": 500,
    "player:birth_year": 350, "club:founded": 160, "club:city": 120, "club:stadium": 100,
}
MULTI_OK = {"player:club", "club:which_player", "wc:semifinalist", "award:ballon_dor_when"}
LEVEL_SHARE = [("easy", 0.25), ("medium", 0.25), ("hard", 0.25), ("expert", 0.17), ("legendary", 0.08)]


def validate(q: Q) -> str | None:
    if not q.answers_ok():
        return "answers"
    for s in (q.text, q.explanation):
        if not HEB.search(s) or len(s) > 160:
            return "text"
    if not q.text.endswith("?"):
        return "punctuation"
    if not q.sources:
        return "source"
    return None


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--openfootball", required=True)
    ap.add_argument("--out", default="content/questions")
    ap.add_argument("--seed", type=int, default=2026)
    args = ap.parse_args()
    rng = random.Random(args.seed)
    names = Names()
    of_dir = Path(args.openfootball)

    crosscheck: dict = {}
    stats = collections.Counter()
    all_q: list[Q] = []
    for fn in (lambda: gen_openfootball.world_cup(names, rng, of_dir, crosscheck),
               lambda: gen_openfootball.leagues(names, rng, of_dir, crosscheck),
               lambda: gen_competitions.build(names, rng, crosscheck),
               lambda: gen_people.build(names, rng)):
        qs, st = fn()
        all_q.extend(qs)
        stats.update(st)

    # Validate + dedupe (same fact, or same question text)
    rejected = collections.Counter()
    seen_keys, seen_text = set(), set()
    good: list[Q] = []
    for q in all_q:
        why = validate(q)
        if why:
            rejected[why] += 1
            continue
        tk = normalize_he(q.text) + "|" + normalize_he(q.correct)
        if q.key in seen_keys or tk in seen_text:
            rejected["duplicate"] += 1
            continue
        seen_keys.add(q.key)
        seen_text.add(tk)
        good.append(q)

    # Same question text with a different correct answer = ambiguous: drop all.
    # ("Which of the following..." questions legitimately repeat with other options.)
    by_text = collections.defaultdict(set)
    for q in good:
        if q.template.split(":")[0] + ":" + q.template.split(":")[1] in MULTI_OK or q.template.startswith("won_when"):
            continue
        by_text[normalize_he(q.text)].add(normalize_he(q.correct))
    amb = {t for t, a in by_text.items() if len(a) > 1}
    rejected["ambiguous_text"] = sum(1 for q in good if normalize_he(q.text) in amb)
    good = [q for q in good if normalize_he(q.text) not in amb]

    # Caps (keep the best-known subjects first)
    by_tpl = collections.defaultdict(list)
    for q in good:
        by_tpl[(q.template, q.category == "israeli_football")].append(q)
    final: list[Q] = []
    for (tpl, isr), qs in by_tpl.items():
        qs.sort(key=lambda q: q.obscurity)
        cap = (CAPS_ISRAEL if isr else CAPS).get(tpl)
        final.extend(qs[:cap] if cap else qs)

    # Difficulty from obscurity quantiles
    final.sort(key=lambda q: (q.obscurity, q.key))
    n = len(final)
    bounds, acc = [], 0.0
    for lvl, share in LEVEL_SHARE:
        acc += share
        bounds.append((lvl, int(round(acc * n))))
    out_rows = []
    i = 0
    for lvl, upto in bounds:
        while i < min(upto, n):
            q = final[i]
            answers = [q.correct, *q.wrong]
            out_rows.append({
                "id": stable_id(q),
                "text_he": q.text,
                "answers_he": answers,          # index 0 is correct; the server shuffles per session
                "explanation_he": q.explanation,
                "category": q.category,
                "topic": q.topic,
                "difficulty": lvl,
                "tags": {k: v for k, v in q.tags.items() if v is not None},
                "template": q.template,
                "source_urls": q.sources,
                "verified_by": q.verified_by,
                "volatile": q.volatile,
                "generator": GEN_VERSION,
            })
            i += 1

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    rng.shuffle(out_rows)
    with (out / "questions.jsonl").open("w", encoding="utf-8") as f:
        for r in sorted(out_rows, key=lambda r: r["id"]):
            f.write(json.dumps(r, ensure_ascii=False) + "\n")

    report = {
        "generator": GEN_VERSION,
        "total": len(out_rows),
        "by_category": collections.Counter(r["category"] for r in out_rows).most_common(),
        "by_difficulty": collections.Counter(r["difficulty"] for r in out_rows).most_common(),
        "by_template": collections.Counter(r["template"].split(":")[0] + ":" + r["template"].split(":")[1] for r in out_rows).most_common(),
        "verified_by": collections.Counter(r["verified_by"] for r in out_rows).most_common(),
        "volatile": sum(r["volatile"] for r in out_rows),
        "rejected": rejected.most_common(),
        "notes": {k: v for k, v in stats.items() if not k.startswith(("unmapped", "incomplete"))},
        "unmapped": {k: v for k, v in stats.items() if k.startswith("unmapped")},
        "incomplete": [k for k in stats if k.startswith("incomplete")],
    }
    (out / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=1), encoding="utf-8")
    print(json.dumps({k: report[k] for k in ("total", "by_category", "by_difficulty", "verified_by", "rejected")}, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
