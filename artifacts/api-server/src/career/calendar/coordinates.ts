/**
 * Approximate map position (latitude, longitude) of every town that hosts a venue or a home area, keyed
 * "COUNTRY:City". Used only to price travel by distance; nothing about who plays where depends on it.
 */
export const CITY_COORDINATES: Readonly<Record<string, readonly [number, number]>> = {
  "GBR:Kilbirnie": [55.754, -4.686], "GBR:Ayr": [55.458, -4.629], "GBR:Kilmarnock": [55.611, -4.496], "GBR:Glasgow": [55.861, -4.250],
  "GBR:Stirling": [56.117, -3.937], "GBR:Edinburgh": [55.953, -3.188], "GBR:Galashiels": [55.617, -2.807], "GBR:Dundee": [56.462, -2.971],
  "GBR:Aberdeen": [57.150, -2.094], "GBR:Inverness": [57.478, -4.224], "GBR:Belfast": [54.597, -5.930], "GBR:Newcastle": [54.978, -1.618],
  "GBR:Blackpool": [53.817, -3.036], "GBR:Liverpool": [53.408, -2.992], "GBR:Manchester": [53.481, -2.243], "GBR:Leeds": [53.801, -1.549],
  "GBR:Wolverhampton": [52.587, -2.129], "GBR:Cardiff": [51.481, -3.179], "GBR:Bristol": [51.455, -2.588], "GBR:Southampton": [50.909, -1.404],
  "GBR:London": [51.507, -0.128],
  "IRL:Dublin": [53.350, -6.260], "IRL:Cork": [51.898, -8.471], "IRL:Galway": [53.271, -9.057],
  "NLD:Utrecht": [52.091, 5.122], "NLD:Rotterdam": [51.924, 4.478], "NLD:Maastricht": [50.851, 5.691], "NLD:Leeuwarden": [53.201, 5.800],
  "BEL:Antwerp": [51.219, 4.402], "BEL:Brussels": [50.850, 4.352], "BEL:Ghent": [51.054, 3.725], "BEL:Liège": [50.633, 5.567],
  "DEU:Berlin": [52.520, 13.405], "DEU:Dortmund": [51.514, 7.468], "DEU:Düsseldorf": [51.228, 6.774], "DEU:Munich": [48.135, 11.582],
  "DEU:Frankfurt": [50.110, 8.682], "DEU:Leipzig": [51.340, 12.375], "DEU:Bremen": [53.079, 8.802],
  "FRA:Paris": [48.857, 2.352], "FRA:Lyon": [45.764, 4.836], "ESP:Barcelona": [41.387, 2.170], "ESP:Madrid": [40.417, -3.704],
  "AUT:Vienna": [48.208, 16.373], "CZE:Prague": [50.076, 14.438], "HUN:Budapest": [47.498, 19.040], "POL:Warsaw": [52.230, 21.012],
  "DNK:Copenhagen": [55.676, 12.568], "SWE:Stockholm": [59.329, 18.069], "SWE:Gothenburg": [57.709, 11.975], "FIN:Helsinki": [60.170, 24.938],
  "EST:Tallinn": [59.437, 24.754],
  "USA:New York": [40.713, -74.006], "USA:Boston": [42.360, -71.059], "USA:Chicago": [41.878, -87.630], "USA:Las Vegas": [36.170, -115.140],
  "CAN:Toronto": [43.653, -79.383], "CAN:Calgary": [51.045, -114.072], "CAN:Halifax": [44.649, -63.575],
  "AUS:Melbourne": [-37.814, 144.963], "AUS:Sydney": [-33.869, 151.209], "AUS:Brisbane": [-27.470, 153.026], "AUS:Perth": [-31.950, 115.860],
  "NZL:Auckland": [-36.848, 174.763], "NZL:Wellington": [-41.287, 174.776], "NZL:Christchurch": [-43.532, 172.637],
  "JPN:Tokyo": [35.676, 139.650], "JPN:Osaka": [34.694, 135.502], "JPN:Nagoya": [35.181, 136.906],
  "SGP:Singapore": [1.352, 103.820], "ZAF:Cape Town": [-33.925, 18.424],
};

/** Straight-line distance in miles between two towns, or null if either is unknown. */
export function milesBetween(a: { country: string; city: string }, b: { country: string; city: string }): number | null {
  const p = CITY_COORDINATES[`${a.country}:${a.city}`], q = CITY_COORDINATES[`${b.country}:${b.city}`];
  if (!p || !q) return null;
  const rad = Math.PI / 180, dLat = (q[0] - p[0]) * rad, dLon = (q[1] - p[1]) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(p[0] * rad) * Math.cos(q[0] * rad) * Math.sin(dLon / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}
