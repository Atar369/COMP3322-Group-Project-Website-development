const RESTAURANT_TIME_ZONE = 'Asia/Hong_Kong';

function getRestaurantDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: RESTAURANT_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const part = type => parts.find(value => value.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function isAtLeastRestaurantTomorrow(dateKey, now = new Date()) {
  const [year, month, day] = getRestaurantDateKey(now).split('-').map(Number);
  const tomorrow = new Date(Date.UTC(year, month - 1, day + 1));
  const minimumDate = `${tomorrow.getUTCFullYear()}-${String(tomorrow.getUTCMonth() + 1).padStart(2, '0')}-${String(tomorrow.getUTCDate()).padStart(2, '0')}`;
  return typeof dateKey === 'string' && dateKey >= minimumDate;
}

function parseUtcDateTime(value) {
  if (!value) return NaN;
  if (value instanceof Date) return value.getTime();
  const timestamp = String(value).trim();
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(timestamp)
    ? `${timestamp.replace(' ', 'T')}Z`
    : timestamp;
  return Date.parse(normalized);
}

module.exports = { getRestaurantDateKey, isAtLeastRestaurantTomorrow, parseUtcDateTime };
