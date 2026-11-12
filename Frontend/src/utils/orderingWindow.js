import { getRestaurantTimestamp } from './restaurantTime';

export const ORDER_WINDOW_MS = 45 * 60 * 1000;
const RESTAURANT_TIME_ZONE = 'Asia/Hong_Kong';

export function isBeforeRestaurantOpening(now = new Date()) {
  return getHongKongTimeParts(now).hour < 10;
}

export function isRestaurantEntryCutoffReached(now = new Date()) {
  const hour = getHongKongTimeParts(now).hour;
  return hour >= 21;
}

export function isRestaurantClosed(now = new Date()) {
  return getHongKongTimeParts(now).hour >= 22;
}

export function isOrderPlacementCutoffReached(now = new Date()) {
  const { hour, minute } = getHongKongTimeParts(now);
  return hour > 21 || (hour === 21 && minute >= 45);
}

export function isQueueEntryWindowOpen(now = new Date()) {
  return !isBeforeRestaurantOpening(now) && !isRestaurantEntryCutoffReached(now);
}

function getHongKongTimeParts(now) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: RESTAURANT_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  return {
    hour: Number(parts.find(part => part.type === 'hour')?.value),
    minute: Number(parts.find(part => part.type === 'minute')?.value),
    second: Number(parts.find(part => part.type === 'second')?.value),
  };
}

export function getQueueCallingCountdown(now = new Date()) {
  const { hour, minute, second } = getHongKongTimeParts(now);
  if (isRestaurantEntryCutoffReached(now)) return { active: false, stopped: true, remainingMs: 0 };
  if (hour < 20) return { active: false, stopped: false, remainingMs: 0 };

  const secondsUntilCutoff = 21 * 60 * 60 - (hour * 60 * 60 + minute * 60 + second);
  const remainingMs = Math.max(0, secondsUntilCutoff * 1000 - now.getUTCMilliseconds());
  return { active: true, stopped: false, remainingMs };
}

export function formatQueueCallingCountdown(remainingMs) {
  const totalSeconds = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')} min ${String(seconds).padStart(2, '0')} sec`;
}

export function getOrderWindowStatus(servedAt, now = Date.now()) {
  const servedTime = getRestaurantTimestamp(servedAt);
  if (!Number.isFinite(servedTime) || servedTime > now) {
    return { remainingMs: 0, ended: true };
  }
  const remainingMs = Math.max(0, ORDER_WINDOW_MS - (now - servedTime));
  return { remainingMs, ended: remainingMs === 0 };
}

export function formatOrderWindowCountdown(remainingMs) {
  const totalSeconds = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')} min ${String(seconds).padStart(2, '0')} sec left for last order`;
}
