"""
Reconstruct Layout A maps EXACTLY from the Event Companion's vector PDF.
Terrain footprints (grey fills) and deployment zones (red/blue fills) are read as
vector geometry and calibrated to the 44x60 board via the board-frame path, so the
dimensions match the printed map precisely. Writes one layout JSON per
Force-Disposition matchup + a side-by-side verification PNG.
"""
import fitz, os, json, cv2
from shapely.geometry import Polygon, box
from shapely.ops import unary_union
import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, '..', 'data')
OUT = os.path.join(DATA, 'layouts')
doc = fitz.open(os.path.join(DATA, 'event_companion.pdf'))
W, H = 44.0, 60.0
RED = (0.62, 0.04, 0.06); BLUE = (0.0, 0.24, 0.41); GREY = (0.82, 0.83, 0.83)

def close(c, t, e=0.04): return c and all(abs(c[i]-t[i]) < e for i in range(3))

def calib(p):
    for d in p.get_drawings():
        r = d['rect']; w = r.x1-r.x0; h = r.y1-r.y0
        if w > 250 and h > 350 and abs((w/h) - 0.733) < 0.02:
            return r.x0, r.y0, w/W, h/H
    raise RuntimeError('board frame not found')

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
        pp = Polygon(pts).buffer(0)
        return pp if pp.area > 1 else None
    except Exception:
        return None

def snap(v, lo, hi, tol=0.8):
    if v < lo + tol: return lo
    if v > hi - tol: return hi
    return round(v * 2) / 2

def extract_terrain(p):
    ox, oy, sx, sy = calib(p)
    polys = [dpoly(d) for d in p.get_drawings() if close(d.get('fill'), GREY)]
    polys = [x for x in polys if x]
    merged = unary_union(polys)              # merges the footprint + offset/shadow overlaps
    geoms = list(merged.geoms) if merged.geom_type == 'MultiPolygon' else [merged]
    out = []
    for i, g in enumerate(geoms):
        x0, y0, x1, y1 = g.bounds
        ix = (x0-ox)/sx; iy = (y0-oy)/sy; iw = (x1-x0)/sx; ih = (y1-y0)/sy
        if iw * ih < 3: continue
        out.append({'id': f't{i}', 'shape': 'rect',
                    'geom': [round(ix, 1), round(iy, 1), round(iw, 1), round(ih, 1)],
                    'label': 'Ruin', 'obscuring': True})
    return out

def extract_zone(p, color):
    ox, oy, sx, sy = calib(p)
    polys = [dpoly(d) for d in p.get_drawings() if close(d.get('fill'), color)]
    polys = [x for x in polys if x]
    if not polys: return []
    u = unary_union(polys)
    if u.geom_type == 'MultiPolygon': u = max(u.geoms, key=lambda g: g.area)
    u = u.simplify(2.0)
    poly = []
    for x, y in u.exterior.coords:
        poly += [snap((x-ox)/sx, 0, W), snap((y-oy)/sy, 0, H)]
    return poly

def extract_details(p, footprints):
    """Gold wall + teal foliage shapes inside the footprints, traced from the raster
    art as plain polygons — the actual line-of-sight features at their real positions."""
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
            for px, py in ap:
                poly += [round((px-ox*S)/(sx*S), 1), round((py-oy*S)/(sy*S), 1)]
            out.append({'kind': kind, 'geom': poly})
        return out
    return conts(teal, 140, 'foliage') + conts(gold, 70, 'wall')

OBJECTIVES = [
    {'id': 'obj_home_p2', 'cx': 17, 'cy': 13, 'type': 'home', 'radiusInch': 3, 'controlledBy': None},
    {'id': 'obj_home_p1', 'cx': 27, 'cy': 47, 'type': 'home', 'radiusInch': 3, 'controlledBy': None},
    {'id': 'obj_exp_r', 'cx': 36, 'cy': 19, 'type': 'expansion', 'radiusInch': 3, 'controlledBy': None},
    {'id': 'obj_exp_l', 'cx': 8, 'cy': 41, 'type': 'expansion', 'radiusInch': 3, 'controlledBy': None},
    {'id': 'obj_central', 'cx': 22, 'cy': 30, 'type': 'central', 'radiusInch': 3, 'controlledBy': None},
]

MATCHUPS = [
    (9, 'Take and Hold', 'Take and Hold'), (12, 'Take and Hold', 'Purge the Foe'),
    (15, 'Take and Hold', 'Disruption'), (18, 'Take and Hold', 'Reconnaissance'),
    (21, 'Take and Hold', 'Priority Assets'), (24, 'Purge the Foe', 'Purge the Foe'),
    (27, 'Purge the Foe', 'Disruption'), (30, 'Purge the Foe', 'Reconnaissance'),
    (33, 'Purge the Foe', 'Priority Assets'), (36, 'Disruption', 'Disruption'),
    (39, 'Disruption', 'Reconnaissance'), (42, 'Disruption', 'Priority Assets'),
    (45, 'Reconnaissance', 'Reconnaissance'), (48, 'Reconnaissance', 'Priority Assets'),
    (51, 'Priority Assets', 'Priority Assets'),
]
slug = lambda s: s.lower().replace(' ', '_')

terrain = extract_terrain(doc[8])
details = extract_details(doc[8], terrain)
print('terrain footprints:', len(terrain), '| details:', len(details),
      '(walls', sum(1 for d in details if d['kind'] == 'wall'),
      'foliage', sum(1 for d in details if d['kind'] == 'foliage'), ')')

for f in os.listdir(OUT):
    if f.startswith('strike_force_'): os.remove(os.path.join(OUT, f))

zones9 = None
for pg, a, b in MATCHUPS:
    red = extract_zone(doc[pg-1], RED)
    blue = extract_zone(doc[pg-1], BLUE)
    if pg == 9: zones9 = (red, blue)
    layout = {'id': f'sf_{slug(a)}__{slug(b)}', 'name': f'{a} vs {b}',
              'boardSize': 'strike_force', 'width': 44, 'height': 60,
              'terrain': terrain, 'details': details, 'objectives': OBJECTIVES,
              'deploymentZones': [{'player': 'player2', 'polygon': red},
                                  {'player': 'player1', 'polygon': blue}]}
    json.dump(layout, open(os.path.join(OUT, f'strike_force_{slug(a)}_v_{slug(b)}.json'), 'w'), indent=2)
    print('wrote', layout['name'], '| red', len(red)//2, 'pts | blue', len(blue)//2, 'pts')

# verification render: original page-9 board vs reconstruction
p = doc[8]; ox, oy, sx, sy = calib(p)
pix = p.get_pixmap(matrix=fitz.Matrix(3, 3))
img = np.frombuffer(pix.samples, np.uint8).reshape(pix.height, pix.width, pix.n)[:, :, :3]
bx0, by0, bx1, by1 = int(ox*3), int(oy*3), int((ox+W*sx)*3), int((oy+H*sy)*3)
orig = Image.fromarray(img[by0:by1, bx0:bx1])
ppi = 11; recon = Image.new('RGB', (int(W*ppi), int(H*ppi)), (26, 43, 31))
d = ImageDraw.Draw(recon, 'RGBA')
def P(poly): return [(poly[i]*ppi, poly[i+1]*ppi) for i in range(0, len(poly), 2)]
if zones9[0]: d.polygon(P(zones9[0]), fill=(200, 45, 45, 130))
if zones9[1]: d.polygon(P(zones9[1]), fill=(45, 95, 205, 130))
for t in terrain:
    x, y, w, h = t['geom']
    d.rectangle([x*ppi, y*ppi, (x+w)*ppi, (y+h)*ppi], fill=(165, 170, 175, 110), outline=(230, 230, 230), width=2)
for o in OBJECTIVES:
    cx, cy, r = o['cx']*ppi, o['cy']*ppi, 3*ppi
    col = {'home': (155, 140, 255), 'expansion': (255, 180, 84), 'central': (90, 209, 122)}[o['type']]
    d.ellipse([cx-r, cy-r, cx+r, cy+r], outline=col, width=2); d.ellipse([cx-6, cy-6, cx+6, cy+6], fill=col)
recon = recon.resize(orig.size)
combo = Image.new('RGB', (orig.width*2+16, orig.height), 'white')
combo.paste(orig, (0, 0)); combo.paste(recon, (orig.width+16, 0))
combo.save(os.path.join(DATA, '_verify_A.png'))
print('saved _verify_A.png')
