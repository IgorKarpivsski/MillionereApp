"""Downloads AI-generated images listed in art/manifest.tsv and stores them as webp.
   manifest line: <output path relative to repo>\t<url>\t<max width>"""
import io, sys, urllib.request
from pathlib import Path
from PIL import Image

for line in Path("art/manifest.tsv").read_text().splitlines():
    if not line.strip() or line.startswith("#"):
        continue
    out, url, width = line.split("\t")
    p = Path(out)
    if p.exists():
        continue
    try:
        data = urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"}), timeout=120).read()
        if p.suffix in (".mp4", ".mp3", ".m4a", ".wav", ".mov"):
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_bytes(data)  # media: keep the original bytes
            print("ok", out, p.stat().st_size)
            continue
        im = Image.open(io.BytesIO(data)).convert("RGBA")
        w = int(width)
        if im.width > w:
            im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
        p.parent.mkdir(parents=True, exist_ok=True)
        if p.suffix == ".png":
            im.save(p, "PNG", optimize=True)
        else:
            im.save(p, "WEBP", quality=82, method=6)
        print("ok", out, p.stat().st_size)
    except Exception as e:
        print("FAIL", out, e, file=sys.stderr)
