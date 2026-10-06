"""Generate a lightweight, bundled SVG from public-domain Natural Earth land.

Run only when updating geography, not during a deploy/build.
Source: https://www.naturalearthdata.com/about/terms-of-use/
"""
import json
import pathlib
import urllib.request

SOURCE = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_land.geojson"


def simplify(points, tolerance=0.055):
    if len(points) < 3:
        return points
    ax, ay = points[0]
    bx, by = points[-1]
    dx, dy = bx-ax, by-ay
    length = dx*dx+dy*dy
    furthest, index = 0, 0
    for i, (x, y) in enumerate(points[1:-1], 1):
        t = max(0, min(1, ((x-ax)*dx+(y-ay)*dy)/length)) if length else 0
        distance = (x-ax-t*dx)**2+(y-ay-t*dy)**2
        if distance > furthest:
            furthest, index = distance, i
    if furthest <= tolerance*tolerance:
        return [points[0], points[-1]]
    return simplify(points[:index+1], tolerance)[:-1]+simplify(points[index:], tolerance)


with urllib.request.urlopen(SOURCE, timeout=30) as response:
    data = json.load(response)
paths = []
for feature in data["features"]:
    geometry = feature["geometry"]
    polygons = geometry["coordinates"] if geometry["type"] == "MultiPolygon" else [geometry["coordinates"]]
    for polygon in polygons:
        rings = []
        for ring in polygon:
            points = simplify(ring)
            rings.append("M"+"L".join(f"{(lon+180)*2:.2f},{(90-lat)*2:.2f}" for lon, lat in points)+"Z")
        paths.append("".join(rings))
svg = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 360">'
       '<!-- Natural Earth 1:50m land, public domain; simplified for Career city-level discovery. -->'
       '<path fill="#1c3448" stroke="#506b80" stroke-width=".18" vector-effect="non-scaling-stroke" '
       'fill-rule="evenodd" d="'+"".join(paths)+'"/></svg>\n')
target = pathlib.Path(__file__).resolve().parent.parent/"src/features/career/pages/world-land.svg"
target.write_text(svg)
print(f"Generated {target.name}: {len(svg.encode())} bytes")
