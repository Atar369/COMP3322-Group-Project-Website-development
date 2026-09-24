// This file stands in for the backend REST API responses.
// Field names match the schema in COMP3322_Restaurant_Website_Structure.docx
// so swapping mock calls for real axios calls later is a 1:1 rename.

export let users = [
  { user_id: 1, name: 'Alice Chan', email: 'alice@example.com', phone: '91234567', password_hash: 'demo', role: 'customer' },
  { user_id: 2, name: 'Manager Wong', email: 'manager@example.com', phone: '98765432', password_hash: 'demo', role: 'manager' },
];

export const menu_items = [
  { item_id: 1, name: 'Truffle Mushroom Risotto', description: 'Arborio rice, wild mushrooms, parmesan, black truffle oil', category: 'Mains', price: 168, is_available: true },
  { item_id: 2, name: 'Charcoal Grilled Salmon', description: 'Miso glaze, roasted seasonal vegetables', category: 'Mains', price: 188, is_available: true },
  { item_id: 3, name: 'Burrata & Heirloom Tomato', description: 'Basil oil, aged balsamic, sourdough crostini', category: 'Starters', price: 98, is_available: true },
  { item_id: 4, name: 'Miso Soup', description: 'Tofu, wakame, scallion', category: 'Starters', price: 48, is_available: true },
  { item_id: 5, name: 'Basque Burnt Cheesecake', description: 'Caramelised top, vanilla bean', category: 'Desserts', price: 68, is_available: true },
  { item_id: 6, name: 'Affogato', description: 'Vanilla gelato, double espresso', category: 'Desserts', price: 52, is_available: false },
];

export let orders = [
  { order_id: 101, user_id: 1, order_time: '2026-09-22T18:20:00', status: 'preparing', total_amount: 236, payment_status: 'paid' },
];

export let order_items = [
  { order_item_id: 1, order_id: 101, item_id: 1, quantity: 1, unit_price: 168, subtotal: 168 },
  { order_item_id: 2, order_id: 101, item_id: 4, quantity: 1, unit_price: 48, subtotal: 48 },
];

// group: 'A' = 1-2 pax, 'B' = 3-6 pax, 'C' = 7+ pax
export let queue_entries = [
  { queue_id: 'A015', user_id: null, party_size: 1, group: 'A', joined_at: '2026-09-24T10:00:00', status: 'serving', called_at: null, seated_at: null },
  { queue_id: 'A016', user_id: null, party_size: 2, group: 'A', joined_at: '2026-09-24T10:05:00', status: 'waiting', called_at: null, seated_at: null },
  { queue_id: 'B027', user_id: null, party_size: 4, group: 'B', joined_at: '2026-09-24T10:01:00', status: 'serving', called_at: null, seated_at: null },
  { queue_id: 'B028', user_id: null, party_size: 5, group: 'B', joined_at: '2026-09-24T10:06:00', status: 'waiting', called_at: null, seated_at: null },
  { queue_id: 'C008', user_id: null, party_size: 8, group: 'C', joined_at: '2026-09-24T10:02:00', status: 'serving', called_at: null, seated_at: null },
];

// counters so new queue IDs increment correctly per group
export const queueCounters = { A: 17, B: 29, C: 9 };

export function getGroupLabel(partySize) {
  if (partySize <= 2) return 'A';
  if (partySize <= 6) return 'B';
  return 'C';
}

export function getGroupRange(group) {
  if (group === 'A') return '1–2 People';
  if (group === 'B') return '3–6 People';
  return '7+ People';
}

export function getNowServing(group) {
  return queue_entries.find(q => q.group === group && q.status === 'serving') || null;
}

export const restaurant_tables = [
  { table_id: 1, table_number: 1, capacity: 2, status: 'available' },
  { table_id: 2, table_number: 2, capacity: 2, status: 'available' },
  { table_id: 3, table_number: 3, capacity: 4, status: 'booked' },
  { table_id: 4, table_number: 4, capacity: 4, status: 'available' },
  { table_id: 5, table_number: 5, capacity: 6, status: 'available' },
];

export let bookings = [
  { booking_id: 1, user_id: 1, table_id: 3, booking_date: '2026-09-23', booking_time: '19:00', party_size: 4, status: 'confirmed', special_request: 'Window seat' },
];

// Dashboard aggregates (would be computed server-side via SQL GROUP BY in the real API)
export const dashboardStats = {
  todayRevenue: 4820,
  revenueTrend: [
    { day: 'Mon', revenue: 3200 }, { day: 'Tue', revenue: 3600 }, { day: 'Wed', revenue: 4100 },
    { day: 'Thu', revenue: 3900 }, { day: 'Fri', revenue: 5200 }, { day: 'Sat', revenue: 6100 }, { day: 'Sun', revenue: 4820 },
  ],
  bestSellers: [
    { name: 'Truffle Risotto', qty: 42 }, { name: 'Grilled Salmon', qty: 35 },
    { name: 'Burrata', qty: 28 }, { name: 'Cheesecake', qty: 22 },
  ],
  ordersByHour: [
    { hour: '11am', orders: 4 }, { hour: '12pm', orders: 12 }, { hour: '1pm', orders: 18 },
    { hour: '6pm', orders: 15 }, { hour: '7pm', orders: 22 }, { hour: '8pm', orders: 19 },
  ],
};

let nextOrderId = 200;
export function createOrder(userId, cartItems) {
  const order_id = nextOrderId++;
  const total_amount = cartItems.reduce((sum, i) => sum + i.price * i.qty, 0);
  orders = [...orders, { order_id, user_id: userId, order_time: new Date().toISOString(), status: 'pending', total_amount, payment_status: 'unpaid' }];
  return order_id;
}

let nextQueueId = 10;
export function joinQueue(userId, partySize) {
  const group = getGroupLabel(partySize);
  const counter = ++queueCounters[group];
  const queue_id = `${group}${String(counter).padStart(3, '0')}`;
  queue_entries = [...queue_entries, { queue_id, user_id: userId, party_size: partySize, group, joined_at: new Date().toISOString(), status: 'waiting', called_at: null, seated_at: null }];
  return queue_id;
}

let nextBookingId = 10;
export function createBooking(userId, tableId, date, time, partySize, request) {
  const conflict = bookings.some(b => b.table_id === tableId && b.booking_date === date && b.booking_time === time && b.status !== 'cancelled');
  if (conflict) return { error: 'This table is already booked for that time slot.' };
  const booking_id = nextBookingId++;
  bookings = [...bookings, { booking_id, user_id: userId, table_id: tableId, booking_date: date, booking_time: time, party_size: partySize, status: 'confirmed', special_request: request }];
  return { booking_id };
}
