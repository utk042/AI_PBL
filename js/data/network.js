// Sample road network for the Greater Noida delivery region (Month 2 extended dataset).
// Coordinates are in km on a local grid; road distance is the straight-line distance
// multiplied by a detour factor (>= 1), so straight-line distance is always an
// admissible heuristic for A*.

export const ROAD_TYPES = {
  highway: { label: 'Expressway', speed: 60 },
  arterial: { label: 'Arterial road', speed: 40 },
  local: { label: 'Local road', speed: 25 },
};

export const NODES = [
  { id: 'N0', name: 'Central Depot (Knowledge Park II)', x: 6.0, y: 5.0, zone: 'industrial', depot: true },
  { id: 'N1', name: 'Pari Chowk', x: 7.0, y: 7.0, zone: 'commercial' },
  { id: 'N2', name: 'Alpha 1', x: 9.0, y: 8.3, zone: 'residential' },
  { id: 'N3', name: 'Alpha 2', x: 10.2, y: 9.6, zone: 'residential' },
  { id: 'N4', name: 'Beta 1', x: 11.2, y: 7.2, zone: 'residential' },
  { id: 'N5', name: 'Beta 2', x: 12.6, y: 6.0, zone: 'commercial' },
  { id: 'N6', name: 'Gamma 1', x: 8.4, y: 10.2, zone: 'residential' },
  { id: 'N7', name: 'Gamma 2 Market', x: 7.0, y: 11.4, zone: 'narrow-lane market' },
  { id: 'N8', name: 'Delta 1', x: 11.6, y: 11.2, zone: 'residential' },
  { id: 'N9', name: 'Knowledge Park III', x: 3.8, y: 6.4, zone: 'institutional' },
  { id: 'N10', name: 'Jagat Farm', x: 9.6, y: 6.2, zone: 'commercial' },
  { id: 'N11', name: 'Surajpur Bazaar', x: 2.8, y: 9.2, zone: 'narrow-lane market' },
  { id: 'N12', name: 'Kasna Industrial Area', x: 13.4, y: 3.4, zone: 'industrial' },
  { id: 'N13', name: 'Techzone 4', x: 4.6, y: 12.6, zone: 'commercial' },
  { id: 'N14', name: 'Gaur City', x: 2.4, y: 13.6, zone: 'residential' },
  { id: 'N15', name: 'Ek Murti Chowk', x: 6.6, y: 14.0, zone: 'commercial' },
  { id: 'N16', name: 'Sector Omicron', x: 14.6, y: 9.0, zone: 'residential' },
  { id: 'N17', name: 'Ecotech III', x: 1.4, y: 4.0, zone: 'industrial' },
  { id: 'N18', name: 'Knowledge Park V', x: 5.4, y: 9.0, zone: 'institutional' },
  { id: 'N19', name: 'Swarn Nagri', x: 14.2, y: 12.6, zone: 'residential' },
  { id: 'N20', name: 'Udyog Vihar', x: 9.0, y: 3.0, zone: 'industrial' },
  { id: 'N21', name: 'Sector Chi', x: 11.0, y: 1.8, zone: 'residential' },
];

// [from, to, road type, detour factor]
const EDGE_SPEC = [
  ['N0', 'N1', 'arterial', 1.15],
  ['N0', 'N9', 'arterial', 1.2],
  ['N0', 'N20', 'highway', 1.1],
  ['N0', 'N18', 'local', 1.3],
  ['N1', 'N2', 'arterial', 1.1],
  ['N1', 'N18', 'local', 1.25],
  ['N1', 'N10', 'arterial', 1.15],
  ['N2', 'N3', 'local', 1.2],
  ['N2', 'N6', 'arterial', 1.15],
  ['N2', 'N4', 'local', 1.3],
  ['N2', 'N10', 'local', 1.2],
  ['N3', 'N8', 'arterial', 1.1],
  ['N3', 'N6', 'local', 1.25],
  ['N3', 'N4', 'local', 1.35],
  ['N4', 'N5', 'arterial', 1.1],
  ['N4', 'N10', 'arterial', 1.15],
  ['N5', 'N12', 'highway', 1.1],
  ['N5', 'N16', 'arterial', 1.2],
  ['N6', 'N7', 'local', 1.3],
  ['N6', 'N18', 'arterial', 1.15],
  ['N7', 'N13', 'arterial', 1.2],
  ['N7', 'N15', 'local', 1.3],
  ['N8', 'N16', 'arterial', 1.15],
  ['N8', 'N19', 'arterial', 1.2],
  ['N8', 'N15', 'highway', 1.1],
  ['N9', 'N11', 'arterial', 1.2],
  ['N9', 'N17', 'highway', 1.1],
  ['N11', 'N18', 'local', 1.3],
  ['N11', 'N14', 'highway', 1.15],
  ['N13', 'N14', 'local', 1.25],
  ['N13', 'N18', 'arterial', 1.2],
  ['N14', 'N15', 'local', 1.3],
  ['N16', 'N19', 'highway', 1.1],
  ['N12', 'N21', 'arterial', 1.15],
  ['N20', 'N21', 'arterial', 1.2],
  ['N20', 'N10', 'arterial', 1.15],
  ['N17', 'N20', 'highway', 1.1],
];

const round1 = (v) => Math.round(v * 10) / 10;
const nodeById = Object.fromEntries(NODES.map((n) => [n.id, n]));

export const EDGES = EDGE_SPEC.map(([from, to, type, factor]) => {
  const a = nodeById[from];
  const b = nodeById[to];
  const straight = Math.hypot(a.x - b.x, a.y - b.y);
  const distance = round1(straight * factor);
  const time = round1((distance / ROAD_TYPES[type].speed) * 60); // minutes
  return { from, to, type, distance, time };
});

export const DEPOT = 'N0';

// Day starts at 09:00 (t = 0); times are minutes after 09:00.
export const DAY_START_HOUR = 9;
export const SERVICE_MINUTES = 10;

export const DELIVERIES = [
  { id: 'D1', node: 'N3', demand: 40, window: [0, 120], priority: 'high', item: 'perishable' },
  { id: 'D2', node: 'N5', demand: 120, window: [60, 240], priority: 'normal', item: 'standard' },
  { id: 'D3', node: 'N7', demand: 25, window: [0, 180], priority: 'normal', item: 'fragile' },
  { id: 'D4', node: 'N12', demand: 350, window: [60, 300], priority: 'normal', item: 'bulk' },
  { id: 'D5', node: 'N13', demand: 60, window: [120, 360], priority: 'low', item: 'standard' },
  { id: 'D6', node: 'N16', demand: 80, window: [0, 150], priority: 'high', item: 'standard' },
  { id: 'D7', node: 'N11', demand: 15, window: [30, 200], priority: 'normal', item: 'perishable' },
  { id: 'D8', node: 'N19', demand: 200, window: [120, 420], priority: 'normal', item: 'bulk' },
  { id: 'D9', node: 'N14', demand: 35, window: [0, 240], priority: 'high', item: 'fragile' },
  { id: 'D10', node: 'N21', demand: 90, window: [60, 300], priority: 'low', item: 'standard' },
  { id: 'D11', node: 'N17', demand: 8, window: [0, 120], priority: 'high', item: 'documents' },
  { id: 'D12', node: 'N8', demand: 50, window: [90, 300], priority: 'normal', item: 'standard' },
];

// Vehicle instances. Their class (Van, RefrigeratedVan, Truck, Bike) is a frame in the
// knowledge base; capacity and speed come from the frame defaults unless overridden.
export const VEHICLES = [
  { id: 'RV-1', label: 'Refrigerated Van RV-1', type: 'RefrigeratedVan' },
  { id: 'VN-2', label: 'Van VN-2', type: 'Van' },
  { id: 'TR-1', label: 'Truck TR-1', type: 'Truck' },
  { id: 'BK-1', label: 'Bike BK-1', type: 'Bike' },
];
