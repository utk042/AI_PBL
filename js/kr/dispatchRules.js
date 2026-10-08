// Knowledge base of the Dispatch Advisor expert system.
// Facts per delivery: item, demand (kg), zone, priority, windowStart, windowEnd (minutes after 09:00).

export const DISPATCH_RULES = [
  {
    id: 'R1', name: 'Perishable goods', salience: 10,
    if: [{ attr: 'item', op: '==', value: 'perishable' }],
    then: [{ assert: 'need', value: 'refrigeration' }],
    because: 'perishable items spoil without temperature control.',
  },
  {
    id: 'R2', name: 'Needs refrigerated van', salience: 9,
    if: [{ attr: 'need', op: 'has', value: 'refrigeration' }],
    then: [{ assert: 'allowed-class', value: 'RefrigeratedVan' }],
    because: 'only refrigerated vans provide cold storage.',
  },
  {
    id: 'R3', name: 'Heavy consignment', salience: 8,
    if: [{ attr: 'demand', op: '>', value: 300 }],
    then: [{ assert: 'allowed-class', value: 'Truck' }],
    because: 'loads above 300 kg exceed every van capacity.',
  },
  {
    id: 'R4', name: 'Bulk goods', salience: 8,
    if: [{ attr: 'item', op: '==', value: 'bulk' }],
    then: [{ assert: 'allowed-class', value: 'Truck' }],
    because: 'bulk goods need loading equipment carried only by trucks.',
  },
  {
    id: 'R5', name: 'Bike payload limit', salience: 7,
    if: [{ attr: 'demand', op: '>', value: 20 }],
    then: [{ assert: 'forbidden-class', value: 'Bike' }],
    because: 'a bike can carry at most 20 kg.',
  },
  {
    id: 'R6', name: 'Narrow lanes', salience: 7,
    if: [{ attr: 'zone', op: '==', value: 'narrow-lane market' }],
    then: [{ assert: 'forbidden-class', value: 'Truck' }, { advise: 'Use a smaller vehicle - market lanes are too narrow for trucks.' }],
    because: 'trucks cannot enter narrow market lanes.',
  },
  {
    id: 'R7', name: 'Fragile goods', salience: 7,
    if: [{ attr: 'item', op: '==', value: 'fragile' }],
    then: [{ assert: 'forbidden-class', value: 'Truck' }, { assert: 'forbidden-class', value: 'Bike' }, { advise: 'Fragile - handle with care, keep upright.' }],
    because: 'fragile items are damaged by truck loading and bike vibration.',
  },
  {
    id: 'R8', name: 'Light documents', salience: 6,
    if: [{ attr: 'item', op: '==', value: 'documents' }, { attr: 'demand', op: '<=', value: 20 }],
    then: [{ assert: 'allowed-class', value: 'Bike' }],
    because: 'small document parcels are fastest and cheapest by bike.',
  },
  {
    id: 'R9', name: 'Urgent delivery', salience: 5,
    if: [{ attr: 'priority', op: '==', value: 'high' }, { attr: 'windowEnd', op: '<=', value: 150 }],
    then: [{ assert: 'wave', value: 'first' }, { advise: 'Urgent - schedule in the first dispatch wave.' }],
    because: 'high-priority orders with an early deadline must leave first.',
  },
  {
    id: 'R10', name: 'Afternoon window', salience: 5,
    if: [{ attr: 'windowStart', op: '>=', value: 120 }],
    then: [{ assert: 'wave', value: 'second' }],
    because: 'the customer cannot receive goods before 11:00.',
  },
  {
    id: 'R11', name: 'General cargo (default)', salience: 0,
    if: [{ attr: 'allowed-class', op: 'absent' }],
    then: [{ assert: 'allowed-class', value: 'Vehicle' }],
    because: 'with no special requirement any vehicle class may be used.',
  },
  {
    id: 'R12', name: 'Default wave', salience: -1,
    if: [{ attr: 'wave', op: 'absent' }],
    then: [{ assert: 'wave', value: 'regular' }],
    because: 'no timing rule applied.',
  },
];
