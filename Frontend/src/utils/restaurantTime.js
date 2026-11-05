const RESTAURANT_TIME_ZONE = 'Asia/Hong_Kong';

function parseUtcTimestamp(value) {
  if (!value) return NaN;
  if (value instanceof Date) return value.getTime();

  const timestamp = String(value).trim();
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(timestamp)
    ? `${timestamp.replace(' ', 'T')}Z`
    : timestamp;
  return Date.parse(normalized);
}

export function getRestaurantDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: RESTAURANT_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const part = type => parts.find(value => value.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function getRestaurantTomorrowDateKey(date = new Date()) {
  const tomorrow = new Date(date.getTime() + 24 * 60 * 60 * 1000);
  return getRestaurantDateKey(tomorrow);
}

export function getRestaurantTimestamp(value) {
  return parseUtcTimestamp(value);
}

export function formatRestaurantDateTime(value, options = {}) {
  const timestamp = parseUtcTimestamp(value);
  if (!Number.isFinite(timestamp)) return '—';

  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: RESTAURANT_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    ...options,
  }).formatToParts(new Date(timestamp));
  const part = type => parts.find(value => value.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')} ${part('hour')}:${part('minute')}`;
}

export function formatRestaurantTime(value, options = {}) {
  const timestamp = parseUtcTimestamp(value);
  if (!Number.isFinite(timestamp)) return '—';

  return new Intl.DateTimeFormat('en-GB', {
    timeZone: RESTAURANT_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    ...options,
  }).format(new Date(timestamp));
}

export function getRestaurantDateForTimestamp(value) {
  const timestamp = parseUtcTimestamp(value);
  return Number.isFinite(timestamp) ? getRestaurantDateKey(new Date(timestamp)) : '';
}

export function compareBookingDateTime(first, second) {
  const firstKey = `${String(first.date || '').slice(0, 10)}T${String(first.time || '').slice(0, 8)}`;
  const secondKey = `${String(second.date || '').slice(0, 10)}T${String(second.time || '').slice(0, 8)}`;
  return firstKey.localeCompare(secondKey);
}
