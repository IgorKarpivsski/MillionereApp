"""
Kids & teens bank: hand-checked, simple general-knowledge questions (no
"which year" questions). Source files: tools/question-gen/kids/<world>.txt

    question | correct | wrong1 | wrong2 | wrong3 | explanation (optional)
    A leading * marks a slightly harder question.

    python3 tools/question-gen/gen_kids.py --out content/kids

Photo questions: <world>.img.txt, same columns plus the Hebrew Wikipedia title whose
free lead photo is shown (resolved by fetch-kids-images.mjs into data/kids-images/;
photos that fail the eye check are listed in data/kids-images/rejects.txt).
"""
import argparse, hashlib, json, re, sys, unicodedata
from pathlib import Path

ROOT = Path(__file__).parent / "kids"
YEAR = re.compile(r"(באיזו שנה|באיזה שנה|באיזו מאה|באיזה עשור|\b1[0-9]{3}\b|\b20[0-9]{2}\b)")


def norm(s):
    s = unicodedata.normalize("NFKC", s)
    s = re.sub(r"[\"'׳״`\-–—.,()]", "", s)
    return re.sub(r"\s+", " ", s).strip().lower()


# Every import tags its rows; kids rows without the current batch were removed from the source files.
BATCH = "2026-10-20"
IMAGES = Path(__file__).parents[2] / "data" / "kids-images"
OK_LICENSE = re.compile(r"(CC0|Public domain|PD|CC BY|CC-BY|GFDL|Attribution|FAL|Free Art)", re.I)


def photo(c, title):
    """Commons metadata (from fetch-kids-images.mjs) -> the app's photo object, or None."""
    if not c or c.get("missing") or c.get("thumbErr") or not c.get("thumb"):
        return None
    lic = (c.get("license") or "").strip()
    if not OK_LICENSE.search(lic) or c.get("mime") not in ("image/jpeg", "image/png", "image/webp", "image/svg+xml"):
        return None
    if (c.get("w") or 0) < 160 or (c.get("h") or 0) < 100:
        return None
    artist = re.sub(r"\s+", " ", c.get("artist") or "").strip()
    if re.search(r"(See File history|uploader|Unknown|unknown|Own work|transferred)", artist):
        artist = ""
    if len(artist) > 60:
        artist = artist[:57] + "…"
    credit = f"{artist} · {lic} · ויקישיתוף" if artist else f"{lic} · ויקישיתוף"
    ratio = c["w"] / c["h"]
    fit = "contain" if title.startswith("דגל ") or ratio > 2.2 or ratio < 0.6 else "cover"
    return {"kind": "photo", "url": c["thumb"].split("?")[0], "credit": credit[:200], "license": lic[:60],
            "page": c.get("page"), "fit": fit, "w": c.get("w"), "h": c.get("h")}


def photo_rows(seen, errors):
    """Photo questions: <world>.img.txt lines, each with the Hebrew Wikipedia title whose photo is shown.
    Only photos that resolved to a free Commons file and passed the eye check (not in rejects.txt) go in."""
    meta_path = IMAGES / "images.json"
    meta = json.loads(meta_path.read_text(encoding="utf-8")) if meta_path.exists() else {}
    rej_path = IMAGES / "rejects.txt"
    rejects = {l.split("#")[0].strip() for l in rej_path.read_text(encoding="utf-8").splitlines()} if rej_path.exists() else set()
    rows, skipped = [], 0
    for f in sorted(ROOT.glob("*.img.txt")):
        world = f.name[: -len(".img.txt")]
        for n, line in enumerate(f.read_text(encoding="utf-8").splitlines(), 1):
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            hard = line.startswith("*")
            parts = [p.strip() for p in line.lstrip("*").split("|")]
            if len(parts) != 7 or any(not p for p in parts[:5]) or not parts[6]:
                errors.append(f"{f.name}:{n} bad line"); continue
            q, c, w1, w2, w3, expl, title = parts
            opts = [c, w1, w2, w3]
            if len({norm(o) for o in opts}) != 4:
                errors.append(f"{f.name}:{n} duplicate options"); continue
            if any(len(o) > 60 for o in opts) or not 8 <= len(q) <= 200:
                errors.append(f"{f.name}:{n} length"); continue
            if YEAR.search(q):
                errors.append(f"{f.name}:{n} year question"); continue
            key = norm(q) + "|" + title
            if key in seen:
                errors.append(f"{f.name}:{n} duplicate photo question"); continue
            seen.add(key)
            img = photo(meta.get(title), title)
            if img is None or title in rejects:
                skipped += 1; continue
            h = hashlib.sha1(f"kids-photo|{world}|{title}|{c}".encode()).hexdigest()[:16]
            rows.append({
                "id": f"q_{h}", "text_he": q, "answers_he": opts, "explanation_he": expl or f"התשובה הנכונה: {c}.",
                "category": world if world != "football" else "legends", "topic": "kids", "difficulty": "medium" if hard else "easy",
                "obscurity": 0.35 if hard else 0.1, "tags": {"audience": "kids", "wiki": title, "batch": BATCH}, "template": "kids_photo:" + world,
                "source_urls": ["https://he.wikipedia.org/wiki/" + title.replace(" ", "_"), img["page"]], "verified_by": "editorial",
                "volatile": False, "generator": "kids-2026.10.2", "image": img,
            })
    print(f"photo questions: {len(rows)} in, {skipped} without a usable/approved photo", file=sys.stderr)
    return rows


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="content/kids")
    a = ap.parse_args()
    rows, errors, seen = [], [], set()
    for f in sorted(p for p in ROOT.glob("*.txt") if not p.name.endswith(".img.txt")):
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
                "obscurity": 0.35 if hard else 0.05, "tags": {"audience": "kids", "batch": BATCH}, "template": "kids:" + world,
                "source_urls": ["https://he.wikipedia.org/"], "verified_by": "editorial", "volatile": False,
                "generator": "kids-2026.10.1", "image": None,
            })
    rows += photo_rows(seen, errors)
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
