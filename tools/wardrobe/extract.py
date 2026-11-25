"""Cuts one accessory out of an edited picture of the same sloth (same pose and framing):
the pixels that changed versus the base, clipped by a background-removal matte of the edited picture."""
import pathlib
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as nd

_session = None


def matte(path: pathlib.Path) -> Image.Image:
    """Alpha of the edited sloth without its background (cached next to the raw file)."""
    global _session
    cache = path.with_name(path.stem + '_alpha.png')
    if cache.exists():
        return Image.open(cache)
    from rembg import new_session, remove
    _session = _session or new_session('isnet-general-use')
    a = remove(Image.open(path).convert('RGB'), session=_session).getchannel('A')
    a.save(cache)
    return a


def extract(B: Image.Image, edit_path: pathlib.Path, thr: float = 34) -> tuple[Image.Image, float]:
    B = B.convert('RGB')
    E = Image.open(edit_path)
    if E.mode in ('RGBA', 'LA', 'P'):
        bg = tuple(int(v) for v in np.median(np.asarray(B)[:20, :20].reshape(-1, 3), axis=0))
        flat = Image.new('RGBA', E.size, bg + (255,)); flat.alpha_composite(E.convert('RGBA')); E = flat
    E = E.convert('RGB').resize(B.size)
    b = np.asarray(B.filter(ImageFilter.GaussianBlur(2.2)), dtype=np.float32)
    e = np.asarray(E.filter(ImageFilter.GaussianBlur(2.2)), dtype=np.float32)
    m = np.abs(b - e).max(axis=2) > thr
    m = nd.binary_opening(m, structure=np.ones((5, 5)))
    lab, n = nd.label(m)
    if n:
        sizes = nd.sum(m, lab, range(1, n + 1))
        keep = [i + 1 for i, s in enumerate(sizes) if s >= max(250, sizes.max() * 0.04)]
        m = np.isin(lab, keep)
    m = nd.binary_closing(m, structure=np.ones((7, 7)), iterations=2)
    m = nd.binary_fill_holes(m)
    m = nd.binary_dilation(m, iterations=3)
    soft = np.asarray(Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2)), dtype=np.float32)
    mt = np.asarray(matte(edit_path).resize(B.size), dtype=np.float32)
    a = np.minimum(soft, mt)
    out = E.convert('RGBA'); out.putalpha(Image.fromarray(a.astype(np.uint8)))
    return out, float((a > 128).mean())
