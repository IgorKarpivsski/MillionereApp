"""Checks a batch of new kids questions before they join the bank.

    python3 tools/question-gen/check_new.py <world> [batch dir, default new]

Reads kids/new/<world>.txt and kids/new/<world>.img.txt and reports, per line:
bad format, duplicate options, too long/short, "which year" questions, the answer
inside the question, and duplicates of each other or of the existing bank
(all kids/*.txt). Photo lines must name a Wikipedia title not already used.
Exit code 1 when anything is wrong.
"""
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from gen_kids import YEAR, norm  # noqa: E402

KIDS = Path(__file__).parent / "kids"


def lines(p):
    if not p.exists():
        return []
    out = []
    for n, l in enumerate(p.read_text(encoding="utf-8").splitlines(), 1):
        l = l.strip()
        if l and not l.startswith("#"):
            out.append((n, l))
    return out


def main():
    world = sys.argv[1]
    batch = sys.argv[2] if len(sys.argv) > 2 else "new"
    seen_q, seen_t = {}, {}
    earlier = sorted(KIDS.glob("*.txt"))
    # a batch must not repeat the bank nor the other draft batches (kids/new, kids/new2, ...)
    for d in sorted(KIDS.glob("new*")):
        if d.is_dir() and d.name != batch:
            earlier += sorted(d.glob("*.txt"))
    for f in earlier:
        for n, l in lines(f):
            parts = [p.strip() for p in l.lstrip("*").split("|")]
            seen_q.setdefault(norm(parts[0]) + ("|" + parts[6] if f.name.endswith(".img.txt") and len(parts) > 6 else ""), f"{f.name}:{n}")
            if f.name.endswith(".img.txt") and len(parts) > 6:
                seen_t.setdefault(parts[6], f"{f.name}:{n}")
    errs = 0
    count = {"text": 0, "photo": 0}
    for kind, f in (("text", KIDS / batch / f"{world}.txt"), ("photo", KIDS / batch / f"{world}.img.txt")):
        for n, l in lines(f):
            parts = [p.strip() for p in l.lstrip("*").split("|")]
            where = f"{f.name}:{n}"
            want = 7 if kind == "photo" else 6
            problem = None
            if len(parts) != want or any(not p for p in parts[:5]) or (kind == "photo" and not parts[6]):
                problem = f"needs exactly {want} columns separated by |"
            else:
                q, c, w1, w2, w3 = parts[:5]
                opts = [c, w1, w2, w3]
                key = norm(q) + ("|" + parts[6] if kind == "photo" else "")
                if len({norm(o) for o in opts}) != 4:
                    problem = "duplicate options"
                elif any(len(o) > 60 for o in opts) or not 8 <= len(q) <= 200:
                    problem = "length (question 8-200 chars, answers up to 60)"
                elif YEAR.search(q):
                    problem = "year question (not allowed)"
                elif kind == "text" and len(norm(c)) > 2 and not c.isdigit() and re.search(r"(^|\s|[בהולמש])" + re.escape(norm(c)) + r"($|\s|\?)", norm(q) + " "):
                    problem = "the answer appears in the question"
                elif key in seen_q:
                    problem = f"duplicate of {seen_q[key]}"
                elif kind == "photo" and parts[6] in seen_t:
                    problem = f"photo title already used at {seen_t[parts[6]]}"
                else:
                    seen_q[key] = where
                    if kind == "photo":
                        seen_t[parts[6]] = where
            if problem:
                errs += 1
                print(f"{where}: {problem}")
            else:
                count[kind] += 1
    print(f"OK lines: {count['text']} text, {count['photo']} photo; problems: {errs}")
    sys.exit(1 if errs else 0)


if __name__ == "__main__":
    main()
