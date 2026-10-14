"""
Kids & teens bank: hand-checked, simple general-knowledge questions (no
"which year" questions). Source files: tools/question-gen/kids/<world>.txt

    question | correct | wrong1 | wrong2 | wrong3 | explanation (optional)
    A leading * marks a slightly harder question.

    python3 tools/question-gen/gen_kids.py --out content/kids
"""
import argparse, hashlib, json, re, sys, unicodedata
from pathlib import Path

ROOT = Path(__file__).parent / "kids"
YEAR = re.compile(r"(באיזו שנה|באיזה שנה|באיזו מאה|באיזה עשור|\b1[0-9]{3}\b|\b20[0-9]{2}\b)")


def norm(s):
    s = unicodedata.normalize("NFKC", s)
    s = re.sub(r"[\"'׳״`\-–—.,()]", "", s)
    return re.sub(r"\s+", " ", s).strip().lower()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="content/kids")
    a = ap.parse_args()
    rows, errors, seen = [], [], set()
    for f in sorted(ROOT.glob("*.txt")):
        world = f.stem
        for n, line in enumerate(f.read_text(encoding="utf-8").splitlines(), 1):
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            hard = line.startswith("*")
            parts = [p.strip() for p in line.lstrip("*").split("|")]
            if len(parts) < 5 or any(not p for p in parts[:5]):
                errors.append(f"{f.name}:{n} bad line"); continue
            q, c, w1, w2, w3 = parts[:5]
            expl = parts[5] if len(parts) > 5 and parts[5] else f"התשובה הנכונה: {c}."
            opts = [c, w1, w2, w3]
            if len({norm(o) for o in opts}) != 4:
                errors.append(f"{f.name}:{n} duplicate options"); continue
            if any(len(o) > 60 for o in opts) or not 8 <= len(q) <= 200:
                errors.append(f"{f.name}:{n} length"); continue
            if YEAR.search(q):
                errors.append(f"{f.name}:{n} year question"); continue
            if len(norm(c)) > 2 and not c.isdigit() and re.search(r"(^|\s|[בהולמש])" + re.escape(norm(c)) + r"($|\s|\?)", norm(q) + " "):
                errors.append(f"{f.name}:{n} answer in question"); continue
            if norm(q) in seen:
                errors.append(f"{f.name}:{n} duplicate question"); continue
            seen.add(norm(q))
            h = hashlib.sha1(f"kids|{world}|{q}|{c}".encode()).hexdigest()[:16]
            rows.append({
                "id": f"q_{h}", "text_he": q, "answers_he": opts, "explanation_he": expl,
                "category": world if world != "football" else "legends", "topic": "kids", "difficulty": "medium" if hard else "easy",
                "obscurity": 0.35 if hard else 0.05, "tags": {"audience": "kids"}, "template": "kids:" + world,
                "source_urls": ["https://he.wikipedia.org/"], "verified_by": "editorial", "volatile": False,
                "generator": "kids-2026.10.1", "image": None,
            })
    for e in errors:
        print("!!", e, file=sys.stderr)
    out = Path(a.out); out.mkdir(parents=True, exist_ok=True)
    with (out / "questions.jsonl").open("w", encoding="utf-8") as fh:
        for r in rows:
            fh.write(json.dumps(r, ensure_ascii=False) + "\n")
    from collections import Counter
    print(len(rows), Counter(r["template"] for r in rows))


if __name__ == "__main__":
    main()
