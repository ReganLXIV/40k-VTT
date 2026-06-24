"""
Reconstruct ALL 45 maps (15 Force-Disposition matchups x terrain Layouts A/B/C)
from the Event Companion vector PDF + raster detail. Pages cycle A,B,C; each
matchup spans 3 consecutive pages. Terrain/walls/foliage come from each layout's
first page; deployment zones come from each individual page.
"""
import fitz, os, json, cv2
import numpy as np
from shapely.geometry import Polygon
from shapely.ops import unary_union
from PIL import Image, ImageDraw

DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data')
OUT = os.path.join(DATA, 'layouts')
doc = fitz.open(os.path.join(DATA, 'event_companion.pdf'))
W, H = 44.0, 60.0
RED = (0.62, 0.04, 0.06); BLUE = (0.0, 0.24, 0.41); GREY = (0.82, 0.83, 0.83)
def cl(c, t, e=0.04): return c and all(abs(c[i]-t[i]) < e for i in range(3))

def calib(p):
    for d in p.get_drawings():
        r = d['rect']; w = r.x1-r.x0; h = r.y1-r.y0
        if w > 250 and h > 350 and abs((w/h)-0.733) < 0.02: return r.x0, r.y0, w/W, h/H
    raise RuntimeError('frame not found')

def dpoly(d):
    pts = []
    for it in d['items']:
        t = it[0]
        if t == 'l': pts += [(it[1].x, it[1].y), (it[2].x, it[2].y)]
        elif t == 're': r = it[1]; pts += [(r.x0, r.y0), (r.x1, r.y0), (r.x1, r.y1), (r.x0, r.y1)]
        elif t == 'c': pts += [(it[1].x, it[1].y), (it[4].x, it[4].y)]
        elif t == 'qu': q = it[1]; pts += [(q.ul.x, q.ul.y), (q.ur.x, q.ur.y), (q.lr.x, q.lr.y), (q.ll.x, q.ll.y)]
    if len(pts) < 3: return None
    try:
        pp = Polygon(pts).buffer(0); return pp if pp.area > 1 else None
    except Exception: return None

def terrain_of(p):
    ox, oy, sx, sy = calib(p)
    polys = [x for x in (dpoly(d) for d in p.get_drawings() if cl(d.get('fill'), GREY)) if x]
    merged = unary_union(polys)
    geoms = list(merged.geoms) if merged.geom_type == 'MultiPolygon' else [merged]
    out = []
    for i, g in enumerate(geoms):
        x0, y0, x1, y1 = g.bounds
        iw = (x1-x0)/sx; ih = (y1-y0)/sy
        if iw*ih < 3: continue
        out.append({'id': f't{i}', 'shape': 'rect',
                    'geom': [round((x0-ox)/sx, 1), round((y0-oy)/sy, 1), round(iw, 1), round(ih, 1)],
                    'label': 'Ruin', 'obscuring': True})
    return out

def snap(v, lo, hi, tol=0.8):
    if v < lo + tol: return lo
    if v > hi - tol: return hi
    return round(v*2)/2

def zone_of(p, color):
    ox, oy, sx, sy = calib(p)
    polys = [x for x in (dpoly(d) for d in p.get_drawings() if cl(d.get('fill'), color)) if x]
    if not polys: return []
    u = unary_union(polys)
    if u.geom_type == 'MultiPolygon': u = max(u.geoms, key=lambda g: g.area)
    u = u.simplify(2.0)
    poly = []
    for x, y in u.exterior.coords:
        poly += [snap((x-ox)/sx, 0, W), snap((y-oy)/sy, 0, H)]
    return poly

def details_of(p, footprints):
    ox, oy, sx, sy = calib(p)
    S = 4.0
    pix = p.get_pixmap(matrix=fitz.Matrix(S, S))
    a = np.frombuffer(pix.samples, np.uint8).reshape(pix.height, pix.width, pix.n)[:, :, :3].astype(int)
    R, G, B = a[:, :, 0], a[:, :, 1], a[:, :, 2]
    fp = np.zeros(a.shape[:2], np.uint8)
    for t in footprints:
        x, y, w, h = t['geom']
        fp[int((oy+y*sy)*S):int((oy+(y+h)*sy)*S), int((ox+x*sx)*S):int((ox+(x+w)*sx)*S)] = 1
    gold = (((R > 140) & (G > 95) & (B < 130) & (R-B > 45) & (R-G > 8) & (G-B > 10)) & (fp > 0)).astype(np.uint8)
    teal = (((G > 85) & (G-R > 18) & (B > 65) & (np.abs(G-B) < 70) & (R < 155)) & (fp > 0)).astype(np.uint8)
    k = np.ones((5, 5), np.uint8)
    gold = cv2.morphologyEx(gold, cv2.MORPH_CLOSE, k)
    teal = cv2.morphologyEx(teal, cv2.MORPH_CLOSE, k)
    def conts(mask, minpx, kind):
        cnts, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        out = []
        for c in cnts:
            if cv2.contourArea(c) < minpx: continue
            ap = cv2.approxPolyDP(c, 0.6*S, True).reshape(-1, 2)
            if len(ap) < 3: continue
            poly = []
            for px, py in ap: poly += [round((px-ox*S)/(sx*S), 1), round((py-oy*S)/(sy*S), 1)]
            out.append({'kind': kind, 'geom': poly})
        return out
    return conts(teal, 140, 'foliage') + conts(gold, 70, 'wall')

OBJ = {
    'A': [(17, 13, 'home'), (27, 47, 'home'), (36, 19, 'expansion'), (8, 41, 'expansion'), (22, 30, 'central')],
    'B': [(7, 30, 'home'), (37, 30, 'home'), (20, 11, 'expansion'), (20, 49, 'expansion'), (22, 30, 'central')],
    'C': [(12, 11, 'home'), (32, 49, 'home'), (33, 11, 'expansion'), (11, 49, 'expansion'), (22, 30, 'central')],
}
def objectives(letter):
    out = []
    for i, (cx, cy, ty) in enumerate(OBJ[letter]):
        out.append({'id': f'obj{i}', 'cx': cx, 'cy': cy, 'type': ty, 'radiusInch': 3, 'controlledBy': None})
    return out

MATCHUPS = [
    ('Take and Hold', 'Take and Hold'), ('Take and Hold', 'Purge the Foe'),
    ('Take and Hold', 'Disruption'), ('Take and Hold', 'Reconnaissance'),
    ('Take and Hold', 'Priority Assets'), ('Purge the Foe', 'Purge the Foe'),
    ('Purge the Foe', 'Disruption'), ('Purge the Foe', 'Reconnaissance'),
    ('Purge the Foe', 'Priority Assets'), ('Disruption', 'Disruption'),
    ('Disruption', 'Reconnaissance'), ('Disruption', 'Priority Assets'),
    ('Reconnaissance', 'Reconnaissance'), ('Reconnaissance', 'Priority Assets'),
    ('Priority Assets', 'Priority Assets'),
]
BASE = {'A': 9, 'B': 10, 'C': 11}
slug = lambda s: s.lower().replace(' ', '_')

for f in os.listdir(OUT):
    if f.startswith('strike_force_'): os.remove(os.path.join(OUT, f))

for letter, base in BASE.items():
    terr = terrain_of(doc[base-1])
    det = details_of(doc[base-1], terr)
    print(f'Layout {letter}: terrain {len(terr)}, details {len(det)} (walls {sum(1 for d in det if d["kind"]=="wall")}, foliage {sum(1 for d in det if d["kind"]=="foliage")})')
    for i, (a, b) in enumerate(MATCHUPS):
        page = base + i*3
        red = zone_of(doc[page-1], RED); blue = zone_of(doc[page-1], BLUE)
        layout = {'id': f'sf_{slug(a)}__{slug(b)}__{letter.lower()}',
                  'name': f'{a} vs {b} — Layout {letter}',
                  'boardSize': 'strike_force', 'width': 44, 'height': 60,
                  'terrain': terr, 'details': det, 'objectives': objectives(letter),
                  'deploymentZones': [{'player': 'player2', 'polygon': red}, {'player': 'player1', 'polygon': blue}]}
        json.dump(layout, open(os.path.join(OUT, f'strike_force_{slug(a)}_v_{slug(b)}_{letter.lower()}.json'), 'w'), indent=2)

    # verification combo: original terrain page vs reconstruction
    p = doc[base-1]; ox, oy, sx, sy = calib(p)
    pix = p.get_pixmap(matrix=fitz.Matrix(3, 3))
    img = np.frombuffer(pix.samples, np.uint8).reshape(pix.height, pix.width, pix.n)[:, :, :3]
    orig = Image.fromarray(img[int(oy*3):int((oy+H*sy)*3), int(ox*3):int((ox+W*sx)*3)])
    red0 = zone_of(p, RED); blue0 = zone_of(p, BLUE)
    ppi = 12; rec = Image.new('RGB', (int(W*ppi), int(H*ppi)), (26, 43, 31))
    dd = ImageDraw.Draw(rec, 'RGBA')
    def Pp(poly): return [(poly[i]*ppi, poly[i+1]*ppi) for i in range(0, len(poly), 2)]
    if red0: dd.polygon(Pp(red0), fill=(200, 45, 45, 120))
    if blue0: dd.polygon(Pp(blue0), fill=(45, 95, 205, 120))
    for t in terr:
        x, y, w, h = t['geom']; dd.rectangle([x*ppi, y*ppi, (x+w)*ppi, (y+h)*ppi], fill=(150, 155, 160, 55), outline=(205, 210, 215), width=1)
    for d in det:
        if d['kind'] == 'foliage': dd.polygon(Pp(d['geom']), fill=(40, 170, 148, 150))
    for d in det:
        if d['kind'] == 'wall': dd.polygon(Pp(d['geom']), fill=(214, 168, 74, 255))
    for cx, cy, ty in OBJ[letter]:
        col = {'home': (155, 140, 255), 'expansion': (255, 180, 84), 'central': (90, 209, 122)}[ty]
        dd.ellipse([(cx-3)*ppi, (cy-3)*ppi, (cx+3)*ppi, (cy+3)*ppi], outline=col, width=2)
        dd.ellipse([cx*ppi-6, cy*ppi-6, cx*ppi+6, cy*ppi+6], fill=col)
    rec = rec.resize(orig.size)
    combo = Image.new('RGB', (orig.width*2+16, orig.height), 'white')
    combo.paste(orig, (0, 0)); combo.paste(rec, (orig.width+16, 0))
    combo.save(os.path.join(DATA, f'_verify_{letter}.png'))
print('done — wrote 45 layouts + verification images')
