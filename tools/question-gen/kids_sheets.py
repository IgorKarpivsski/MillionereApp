"""Contact sheets for reviewing kids photo questions by eye.

Reads data/kids-images/images.json + thumbs/<idx>.jpg and writes
data/kids-images/sheets/sheet-NN.jpg (numbered cells) and sheets/index.txt
(number -> Wikipedia title), so a reviewer can check each photo matches its answer.
"""
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

OUT = Path("data/kids-images")
COLS, ROWS, W, H, LABEL = 5, 4, 240, 180, 26

images = json.loads((OUT / "images.json").read_text(encoding="utf-8"))
ok = sorted(((v["idx"], t) for t, v in images.items() if not v.get("missing") and v.get("idx")))
# Drafts waiting for review (kids/new/*.img.txt): only their photos go on the sheets.
new_titles = set()
for f in Path("tools/question-gen/kids/new").glob("*.img.txt"):
    for line in f.read_text(encoding="utf-8").splitlines():
        parts = [p.strip() for p in line.split("|")]
        if not line.startswith("#") and len(parts) > 6 and parts[6]:
            new_titles.add(parts[6])
if new_titles:
    ok = [(i, t) for i, t in ok if t in new_titles]
sheets = OUT / "sheets"
sheets.mkdir(parents=True, exist_ok=True)
for old in sheets.glob("sheet-*.jpg"):
    old.unlink()
try:
    font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 20)
except OSError:
    font = ImageFont.load_default()

per = COLS * ROWS
lines = []
for s in range(0, len(ok), per):
    chunk = ok[s : s + per]
    sheet = Image.new("RGB", (COLS * W, ROWS * (H + LABEL)), "white")
    d = ImageDraw.Draw(sheet)
    for k, (idx, title) in enumerate(chunk):
        x, y = (k % COLS) * W, (k // COLS) * (H + LABEL)
        p = OUT / "thumbs" / f"{idx}.jpg"
        try:
            im = Image.open(p).convert("RGB")
            im.thumbnail((W - 6, H - 6))
            sheet.paste(im, (x + (W - im.width) // 2, y + LABEL + (H - im.height) // 2))
        except Exception:
            d.text((x + 10, y + LABEL + 60), "NO IMAGE", fill="red", font=font)
        d.rectangle([x, y, x + W - 1, y + LABEL], fill="#222")
        d.text((x + 6, y + 2), f"#{idx}", fill="yellow", font=font)
        lines.append(f"{idx}\t{s // per + 1:02d}\t{title}")
    sheet.save(sheets / f"sheet-{s // per + 1:02d}.jpg", quality=80)
(sheets / "index.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")
print(f"{len(ok)} photos on {(len(ok) + per - 1) // per} sheets")
