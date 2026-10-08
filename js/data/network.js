// Month 2 dataset: real Greater Noida places and roads (roads.js) plus today's orders and fleet.

export { ROAD_TYPES, NODES, EDGES } from './roads.js';

export const DEPOT = 'N0';

// Day starts at 09:00 (t = 0); times are minutes after 09:00.
export const DAY_START_HOUR = 9;
export const SERVICE_MINUTES = 10;

export const DELIVERIES = [
  { id: 'D1', node: 'N3', customer: 'Fresh Basket', demand: 40, window: [0, 120], priority: 'high', item: 'perishable' },
  { id: 'D2', node: 'N5', customer: 'Beta Electronics', demand: 120, window: [60, 240], priority: 'normal', item: 'standard' },
  { id: 'D3', node: 'N6', customer: 'Glass House', demand: 25, window: [0, 180], priority: 'normal', item: 'fragile' },
  { id: 'D4', node: 'N22', customer: 'Udyog Steel Works', demand: 350, window: [60, 300], priority: 'normal', item: 'bulk' },
  { id: 'D5', node: 'N20', customer: 'Sharda University store', demand: 60, window: [120, 360], priority: 'low', item: 'standard' },
  { id: 'D6', node: 'N15', customer: 'Omicron Pharmacy', demand: 80, window: [0, 150], priority: 'high', item: 'standard' },
  { id: 'D7', node: 'N23', customer: 'Surajpur Dairy', demand: 15, window: [30, 200], priority: 'normal', item: 'perishable' },
  { id: 'D8', node: 'N24', customer: 'Tilapta Builders', demand: 200, window: [120, 420], priority: 'normal', item: 'bulk' },
  { id: 'D9', node: 'N16', customer: 'Venice Crockery', demand: 35, window: [0, 240], priority: 'high', item: 'fragile' },
  { id: 'D10', node: 'N17', customer: 'Chi 3 Kirana', demand: 90, window: [60, 300], priority: 'low', item: 'standard' },
  { id: 'D11', node: 'N19', customer: 'NIET admin office', demand: 8, window: [0, 120], priority: 'high', item: 'documents' },
  { id: 'D12', node: 'N11', customer: 'Eta Home Needs', demand: 50, window: [90, 300], priority: 'normal', item: 'standard' },
];

// Vehicle instances. Their class (Van, RefrigeratedVan, Truck, Bike) is a frame in the
// knowledge base; capacity, speed, fuel use and fare rates come from the frame defaults.
export const VEHICLES = [
  { id: 'RV-1', label: 'Refrigerated van RV-1', type: 'RefrigeratedVan' },
  { id: 'VN-2', label: 'Van VN-2', type: 'Van' },
  { id: 'TR-1', label: 'Truck TR-1', type: 'Truck' },
  { id: 'BK-1', label: 'Bike BK-1', type: 'Bike' },
];
