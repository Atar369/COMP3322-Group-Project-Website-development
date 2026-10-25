const ORDER_WINDOW_MS = 45 * 60 * 1000;
const RESTAURANT_TIME_ZONE = 'Asia/Hong_Kong';

function isLastOrderCutoffReached(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: RESTAURANT_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const hour = Number(parts.find(part => part.type === 'hour')?.value);
  return hour >= 21;
}

function isOrderWindowOpen(servedAt, now = Date.now()) {
  const servedTime = new Date(servedAt).getTime();
  return Number.isFinite(servedTime)
    && servedTime <= now
    && now - servedTime < ORDER_WINDOW_MS;
}

module.exports = { isLastOrderCutoffReached, isOrderWindowOpen };
