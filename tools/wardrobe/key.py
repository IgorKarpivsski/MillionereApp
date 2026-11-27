"""Cuts an accessory out of an edit of base_green.png (the sloth painted bright green on light grey):
everything that is neither the grey background nor the green body is the item."""
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as nd


_TBG = {}


def _template_body(size):
    """True where base_green.png shows the green sloth."""
    if size not in _TBG:
        import pathlib
        t = np.asarray(Image.open(pathlib.Path(__file__).parent / 'base_green.png').convert('RGB').resize(size), dtype=np.float32) / 255
        _TBG[size] = (t[..., 1] - np.maximum(t[..., 0], t[..., 2])) > 0.08
    return _TBG[size]


def _template_bg(size):
    """True where base_green.png is plain background (not the green sloth)."""
    return ~nd.binary_dilation(_template_body(size), iterations=2)


def bleed(im: Image.Image, solid: int = 230) -> Image.Image:
    """Soft edge pixels take the colour of the nearest solid pixel (no grey fringe from the old background)."""
    arr = np.asarray(im.convert('RGBA')).copy()
    a = arr[..., 3]
    src = a >= solid
    if not src.any():
        return im
    _, (iy, ix) = nd.distance_transform_edt(~src, return_indices=True)
    edge = (a > 0) & ~src
    arr[..., :3][edge] = arr[iy[edge], ix[edge], :3]
    return Image.fromarray(arr)


def _rembg_alpha(path, size):
    import pathlib
    path = pathlib.Path(path)
    cache = path.with_name(path.stem + '_alpha.png')
    if not cache.exists():
        from rembg import new_session, remove
        global _SESSION
        try:
            _SESSION
        except NameError:
            _SESSION = new_session('isnet-general-use')
        remove(Image.open(path).convert('RGB'), session=_SESSION).getchannel('A').save(cache)
    return np.asarray(Image.open(cache).resize(size), dtype=np.float32) / 255


def key(path, size=(860, 1280)):
    E = Image.open(path).convert('RGB').resize(size, Image.LANCZOS)
    a = np.asarray(E, dtype=np.float32) / 255
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    mx, mn = a.max(axis=2), a.min(axis=2)
    sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    # greenness: how much green beats the other two channels
    gx = g - np.maximum(r, b)
    green = (gx > 0.10) & (sat > 0.30)
    soft_green = np.clip((gx - 0.04) / 0.10, 0, 1) * (sat > 0.2)   # 0 = not green, 1 = surely green
    # the background: light grey that is also background in the template (a white coat over the body stays)
    bgc = np.median(np.concatenate([a[:8].reshape(-1, 3), a[-8:].reshape(-1, 3)]), axis=0)
    near = np.abs(a - bgc).max(axis=2) < 0.045
    lab0, _ = nd.label(near)
    edge = np.unique(np.concatenate([lab0[0], lab0[-1], lab0[:, 0], lab0[:, -1]]))
    # ...and that a background-removal model also calls background (white hats and pompoms stay)
    shadow = (sat < 0.10) & (np.abs(a - bgc).max(axis=2) < 0.20)          # soft grey drop shadows
    grey = (np.isin(lab0, edge[edge > 0]) | shadow) & _template_bg(size) & (_rembg_alpha(path, size) < 0.5)
    m = ~green & ~grey
    # the outline of the green figure blends into the grey: those pale edge pixels are not the item
    body = _template_body(size)
    band = nd.binary_dilation(body, iterations=5) & ~nd.binary_erosion(body, iterations=3)
    pale = ((sat < 0.22) & (mx > 0.55)) | (gx > 0.0)
    m &= ~(band & pale & (_rembg_alpha(path, size) < 0.5) | (band & (gx > 0.0)))
    m = nd.binary_opening(m, structure=np.ones((3, 3)))
    lab, n = nd.label(m)
    if n:
        sizes = nd.sum(m, lab, range(1, n + 1))
        keep = [i + 1 for i, s in enumerate(sizes) if s >= max(200, sizes.max() * 0.03)]
        m = np.isin(lab, keep)
    # light-grey gaps inside the item (white fabric shading) belong to it
    m = m | (nd.binary_fill_holes(nd.binary_closing(m, structure=np.ones((9, 9)))) & near)
    alpha = m.astype(np.float32) * (1 - 0.85 * soft_green)
    alpha = np.asarray(Image.fromarray((alpha * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8)), dtype=np.float32)
    # despill: no green fringe on the item's edges
    out = np.asarray(E, dtype=np.float32)
    lim = np.maximum(out[..., 0], out[..., 2])
    out[..., 1] = np.where(out[..., 1] > lim * 1.05, lim * 1.05, out[..., 1])
    im = Image.fromarray(out.clip(0, 255).astype(np.uint8)).convert('RGBA')
    im.putalpha(Image.fromarray(alpha.clip(0, 255).astype(np.uint8)))
    return bleed(im)
