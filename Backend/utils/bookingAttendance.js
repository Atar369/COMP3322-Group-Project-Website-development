const RESTAURANT_UTC_OFFSET_HOURS = 8;
const CHECK_IN_WINDOW_MINUTES = 15;

function isCheckInWindowOpen(bookingDate, bookingTime, now = new Date()) {
  const date = bookingDate instanceof Date
    ? `${bookingDate.getUTCFullYear()}-${String(bookingDate.getUTCMonth() + 1).padStart(2, '0')}-${String(bookingDate.getUTCDate()).padStart(2, '0')}`
    : String(bookingDate).slice(0, 10);
  const time = String(bookingTime).slice(0, 8);
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute, second = '0'] = time.split(':');
  if (![year, month, day, Number(hour), Number(minute), Number(second)].every(Number.isFinite)) return false;

  const bookingUtc = Date.UTC(year, month - 1, day, Number(hour) - RESTAURANT_UTC_OFFSET_HOURS, Number(minute), Number(second));
  const current = now.getTime();
  return current >= bookingUtc && current < bookingUtc + CHECK_IN_WINDOW_MINUTES * 60 * 1000;
}

module.exports = { isCheckInWindowOpen };
