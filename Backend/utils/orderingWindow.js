const ORDER_WINDOW_MS = 45 * 60 * 1000;
const RESTAURANT_TIME_ZONE = 'Asia/Hong_Kong';
const { parseUtcDateTime } = require('./restaurantTime');

function getRestaurantHour(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: RESTAURANT_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  return Number(parts.find(part => part.type === 'hour')?.value);
}

function isBeforeRestaurantOpening(now = new Date()) {
  return getRestaurantHour(now) < 10;
}

function isRestaurantEntryCutoffReached(now = new Date()) {
  return getRestaurantHour(now) >= 21;
}

function isRestaurantClosed(now = new Date()) {
  return getRestaurantHour(now) >= 22;
}

function isOrderPlacementCutoffReached(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: RESTAURANT_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const hour = Number(parts.find(part => part.type === 'hour')?.value);
  const minute = Number(parts.find(part => part.type === 'minute')?.value);
  return hour > 21 || (hour === 21 && minute >= 45);
}

function isQueueEntryWindowOpen(now = new Date()) {
  return !isBeforeRestaurantOpening(now) && !isRestaurantEntryCutoffReached(now);
}

function isOrderWindowOpen(servedAt, now = Date.now()) {
  const servedTime = parseUtcDateTime(servedAt);
  return Number.isFinite(servedTime)
    && servedTime <= now
    && now - servedTime < ORDER_WINDOW_MS;
}

module.exports = {
  isBeforeRestaurantOpening,
  isRestaurantEntryCutoffReached,
  isOrderWindowOpen,
  isRestaurantClosed,
  isOrderPlacementCutoffReached,
  isQueueEntryWindowOpen,
};
