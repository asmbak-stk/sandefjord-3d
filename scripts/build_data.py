#!/usr/bin/env python3
"""
Fetches OSM building/water/road/green-area data for central Sandefjord from
the Overpass API and converts it into a flat local-meter JSON file consumed
by the Three.js app at public/data/sandefjord.json.

Requires: pip install requests shapely
Run from the project root: python3 scripts/build_data.py
"""
import json, math, re, sys, time
from pathlib import Path

import requests
from shapely.geometry import Polygon, box
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parent.parent
OUT_PATH = ROOT / "public" / "data" / "sandefjord.json"

# Origin at Hvalfangstmonumentet (the whaling monument) — scene (0,0)
ORIGIN_LAT = 59.1274372
ORIGIN_LON = 10.2256699

BBOX_S, BBOX_W, BBOX_N, BBOX_E = 59.122, 10.212, 59.137, 10.231

OVERPASS_MIRRORS = [
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass-api.de/api/interpreter",
]

LANDMARKS_LATLON = {
    "hvalfangstmonumentet": (59.1274372, 10.2256699),
    "sandarKirke": (59.1343144, 10.2264654),
    "hvalfangstmuseet": (59.1311410, 10.2273850),
    "torget": (59.1300945, 10.2254542),
    "scandicPark": (59.1275270, 10.2208152),
}

M_PER_DEG_LAT = 111320.0
M_PER_DEG_LON = 111320.0 * math.cos(math.radians(ORIGIN_LAT))


def to_local(lat, lon):
    x = (lon - ORIGIN_LON) * M_PER_DEG_LON
    z = (ORIGIN_LAT - lat) * M_PER_DEG_LAT  # north = -Z, south = +Z
    return (round(x, 2), round(z, 2))


def overpass_query(query):
    last_err = None
    for url in OVERPASS_MIRRORS:
        try:
            r = requests.post(url, data={"data": query}, timeout=90)
            if r.status_code == 200:
                return r.json()["elements"]
            last_err = f"{url} -> HTTP {r.status_code}"
        except Exception as e:  # noqa: BLE001
            last_err = f"{url} -> {e}"
        print(f"  mirror failed: {last_err}", file=sys.stderr)
        time.sleep(1)
    raise RuntimeError(f"All Overpass mirrors failed: {last_err}")


def fetch_all():
    b = f"{BBOX_S},{BBOX_W},{BBOX_N},{BBOX_E}"
    print("Fetching buildings...")
    buildings = overpass_query(
        f'[out:json][timeout:60];(way["building"]({b});relation["building"]({b}););out geom;'
    )
    print("Fetching water/coastline...")
    water = overpass_query(
        f'[out:json][timeout:60];(way["natural"="coastline"]({b});way["natural"="water"]({b});'
        f'relation["natural"="water"]({b});way["landuse"="harbour"]({b});'
        f'way["leisure"="marina"]({b});way["waterway"="dock"]({b}););out geom;'
    )
    print("Fetching roads...")
    roads = overpass_query(
        f'[out:json][timeout:60];(way["highway"~"primary|secondary|tertiary|residential|'
        f'pedestrian|footway|living_street|service|path"]({b}););out geom;'
    )
    print("Fetching green areas...")
    green = overpass_query(
        f'[out:json][timeout:60];(way["leisure"="park"]({b});'
        f'way["landuse"~"grass|forest|cemetery|recreation_ground"]({b});'
        f'way["natural"="wood"]({b});way["amenity"="parking"]({b}););out geom;'
    )
    print("Fetching railway...")
    rail = overpass_query(
        f'[out:json][timeout:60];(way["railway"~"rail|light_rail"]({b}););out geom;'
    )
    return buildings, water, roads, green, rail


HEIGHT_DEFAULTS = {
    "church": 18, "chapel": 10, "religious": 10,
    "apartments": 15, "residential": 12,
    "house": 7, "semidetached_house": 7, "terrace": 7, "bungalow": 5,
    "hotel": 20, "office": 14, "commercial": 8, "retail": 7,
    "civic": 12, "school": 9, "kindergarten": 6, "hospital": 16,
    "industrial": 8, "warehouse": 8, "garage": 2.5, "garages": 2.5, "shed": 2.5,
    "roof": 3, "kiosk": 3, "boathouse": 4, "transportation": 6, "train_station": 7,
    "sports_centre": 9, "fire_station": 9, "parking": 3, "service": 4, "container": 2.5,
    "ship": 5, "yes": 7,
}


def parse_height(tags):
    if "height" in tags:
        m = re.search(r"[\d.]+", tags["height"])
        if m:
            return float(m.group())
    if "building:levels" in tags:
        m = re.search(r"[\d.]+", tags["building:levels"])
        if m:
            return float(m.group()) * 3.2 + 1.0
    return HEIGHT_DEFAULTS.get(tags.get("building", "yes"), 7.0)


# OSM has essentially no roof:shape data for Sandefjord (checked: 0 of 1527
# buildings tag it), so which roof a building "really" has can't be read from
# the data — this is a category-based heuristic, not a fact per building.
# Small residential/utility buildings are overwhelmingly pitched-roof in
# Norway; everything else (apartments, commercial, civic, industrial...) is
# left flat, which is the statistically safer default for a Norwegian
# town centre.
GABLED_CATEGORIES = {
    "house", "semidetached_house", "terrace", "bungalow",
    "garage", "garages", "shed", "boathouse", "kindergarten", "chapel",
}


def compute_obb(poly):
    try:
        mrr = poly.minimum_rotated_rectangle
        coords = list(mrr.exterior.coords)[:-1]
    except Exception:
        return None
    if len(coords) != 4:
        return None
    e0 = math.hypot(coords[1][0] - coords[0][0], coords[1][1] - coords[0][1])
    e1 = math.hypot(coords[2][0] - coords[1][0], coords[2][1] - coords[1][1])
    if e0 < 1.5 or e1 < 1.5:
        return None  # degenerate sliver, skip roof
    cx = sum(c[0] for c in coords) / 4
    cz = sum(c[1] for c in coords) / 4
    ang01 = math.atan2(coords[1][1] - coords[0][1], coords[1][0] - coords[0][0])
    if e0 >= e1:
        depth, width, angle = e0, e1, ang01
    else:
        depth, width, angle = e1, e0, ang01 + math.pi / 2
    return {
        "cx": round(cx, 2), "cz": round(cz, 2),
        "width": round(width, 2), "depth": round(depth, 2),
        "angle": round(angle, 4),
    }


def ring_to_local(geom_list):
    pts = [to_local(p["lat"], p["lon"]) for p in geom_list]
    out = []
    for p in pts:
        if not out or out[-1] != p:
            out.append(p)
    return out


def process_buildings(raw):
    buildings = []
    bid = 0
    for e in raw:
        tags = e.get("tags", {})
        if tags.get("building") == "no":
            continue
        outer, holes = None, []
        if e["type"] == "way":
            geom = e.get("geometry")
            if not geom or len(geom) < 4:
                continue
            outer = ring_to_local(geom)
        elif e["type"] == "relation":
            for m in e.get("members", []):
                if "geometry" not in m or len(m["geometry"]) < 4:
                    continue
                ring = ring_to_local(m["geometry"])
                if m.get("role") == "outer" and outer is None:
                    outer = ring
                elif m.get("role") == "inner":
                    holes.append(ring)
            if outer is None:
                continue
        else:
            continue

        try:
            poly = Polygon(outer, holes)
            if not poly.is_valid:
                poly = poly.buffer(0)
            if poly.is_empty or poly.area < 4:
                continue
        except Exception:
            continue

        bid += 1
        category = tags.get("building", "yes")
        record = {
            "id": bid,
            "footprint": outer,
            "holes": holes,
            "height": round(parse_height(tags), 1),
            "category": category,
            "name": tags.get("name"),
            "roofShape": "flat",
        }
        if category in GABLED_CATEGORIES:
            obb = compute_obb(poly)
            if obb:
                record["roofShape"] = "gabled"
                record["roofOBB"] = obb
        buildings.append(record)
    return buildings


def chain_segments(segs):
    segs = [list(s) for s in segs]
    chains = []
    EPS = 1.0

    def close(a, b):
        return abs(a[0] - b[0]) < EPS and abs(a[1] - b[1]) < EPS

    used = [False] * len(segs)
    for i in range(len(segs)):
        if used[i]:
            continue
        chain = segs[i][:]
        used[i] = True
        extended = True
        while extended:
            extended = False
            for j in range(len(segs)):
                if used[j]:
                    continue
                s = segs[j]
                if close(chain[-1], s[0]):
                    chain.extend(s[1:]); used[j] = True; extended = True
                elif close(chain[-1], s[-1]):
                    chain.extend(list(reversed(s))[1:]); used[j] = True; extended = True
                elif close(chain[0], s[-1]):
                    chain = s[:-1] + chain; used[j] = True; extended = True
                elif close(chain[0], s[0]):
                    chain = list(reversed(s))[:-1] + chain; used[j] = True; extended = True
        chains.append(chain)
    return chains


def process_water(raw, bbox_poly):
    coastline_segs, closed_polys = [], []
    for e in raw:
        tags = e.get("tags", {})
        geom = e.get("geometry")
        if not geom or len(geom) < 2:
            continue
        pts = ring_to_local(geom)
        if tags.get("natural") == "coastline":
            coastline_segs.append(pts)
        elif len(pts) >= 3:
            if pts[0] != pts[-1]:
                pts.append(pts[0])
            try:
                p = Polygon(pts)
                if p.is_valid and p.area > 4:
                    closed_polys.append(p)
            except Exception:
                pass

    chains = chain_segments(coastline_segs)
    BIG = 6000.0
    sea_polys = []
    for chain in chains:
        if len(chain) < 2:
            continue
        sx, sz = chain[0]
        ex, ez = chain[-1]
        try:
            p = Polygon(chain + [(ex, BIG), (sx, BIG)])
            if not p.is_valid:
                p = p.buffer(0)
            clipped = p.intersection(bbox_poly)
            if not clipped.is_empty:
                sea_polys.append(clipped)
        except Exception:
            pass

    merged = unary_union(sea_polys + closed_polys)
    geoms = merged.geoms if hasattr(merged, "geoms") else [merged]
    out = []
    for g in geoms:
        if g.is_empty or g.area < 4:
            continue
        out.append({
            "exterior": [[round(x, 2), round(z, 2)] for x, z in g.exterior.coords],
            "holes": [[[round(x, 2), round(z, 2)] for x, z in i.coords] for i in g.interiors],
            "area": round(g.area, 1),
        })
    out.sort(key=lambda w: -w["area"])
    return out


ROAD_WIDTH = {
    "primary": 9, "primary_link": 6, "secondary": 7, "secondary_link": 5,
    "tertiary": 6, "residential": 5, "living_street": 4.5,
    "pedestrian": 4, "footway": 1.8, "path": 1.2, "service": 3.5,
}


def process_roads(raw):
    roads = []
    for e in raw:
        tags = e.get("tags", {})
        geom = e.get("geometry")
        if not geom or len(geom) < 2:
            continue
        pts = ring_to_local(geom)
        if len(pts) < 2:
            continue
        hwy = tags.get("highway", "residential")
        roads.append({"points": pts, "kind": hwy, "width": ROAD_WIDTH.get(hwy, 4)})
    return roads


def process_rail(raw):
    rails = []
    for e in raw:
        geom = e.get("geometry")
        if not geom or len(geom) < 2:
            continue
        pts = ring_to_local(geom)
        if len(pts) < 2:
            continue
        rails.append({"points": pts})
    return rails


def process_green(raw):
    green = []
    for e in raw:
        tags = e.get("tags", {})
        geom = e.get("geometry")
        if not geom or len(geom) < 4:
            continue
        pts = ring_to_local(geom)
        if len(pts) < 3:
            continue
        try:
            if not Polygon(pts).is_valid or Polygon(pts).area < 9:
                continue
        except Exception:
            continue
        kind = tags.get("leisure") or tags.get("landuse") or tags.get("natural") or tags.get("amenity") or "grass"
        green.append({"footprint": pts, "kind": kind})
    return green


def main():
    minx, minz = to_local(BBOX_S, BBOX_W)
    maxx, maxz = to_local(BBOX_N, BBOX_E)
    bbox_poly = box(min(minx, maxx), min(minz, maxz), max(minx, maxx), max(minz, maxz))

    raw_buildings, raw_water, raw_roads, raw_green, raw_rail = fetch_all()

    out = {
        "origin": {"lat": ORIGIN_LAT, "lon": ORIGIN_LON},
        "bbox": {"s": BBOX_S, "w": BBOX_W, "n": BBOX_N, "e": BBOX_E},
        "bboxLocal": {
            "minX": min(minx, maxx), "maxX": max(minx, maxx),
            "minZ": min(minz, maxz), "maxZ": max(minz, maxz),
        },
        "landmarks": {k: {"x": v[0], "z": v[1]} for k, v in
                      {k: to_local(*v) for k, v in LANDMARKS_LATLON.items()}.items()},
        "buildings": process_buildings(raw_buildings),
        "water": process_water(raw_water, bbox_poly),
        "roads": process_roads(raw_roads),
        "green": process_green(raw_green),
        "rail": process_rail(raw_rail),
    }

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_PATH, "w") as f:
        json.dump(out, f)

    print(f"Wrote {OUT_PATH} ({OUT_PATH.stat().st_size} bytes)")
    print(f"  buildings={len(out['buildings'])} water={len(out['water'])} "
          f"roads={len(out['roads'])} green={len(out['green'])} rail={len(out['rail'])}")


if __name__ == "__main__":
    main()
