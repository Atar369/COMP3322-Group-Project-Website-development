const RESTAURANT_UTC_OFFSET_HOURS = 8;
const CHECK_IN_WINDOW_MS = 15 * 60 * 1000;

function getBookingStartTime(bookingDate, bookingTime) {
  const date = bookingDate instanceof Date
    ? `${bookingDate.getUTCFullYear()}-${String(bookingDate.getUTCMonth() + 1).padStart(2, '0')}-${String(bookingDate.getUTCDate()).padStart(2, '0')}`
    : String(bookingDate || '').slice(0, 10);
  const time = String(bookingTime || '').slice(0, 8);
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute, second = '0'] = time.split(':');
  if (![year, month, day, Number(hour), Number(minute), Number(second)].every(Number.isFinite)) return NaN;
  return Date.UTC(year, month - 1, day, Number(hour) - RESTAURANT_UTC_OFFSET_HOURS, Number(minute), Number(second));
}

export function isBookingCheckInAvailable(bookingDate, bookingTime, now = Date.now()) {
  const bookingStart = getBookingStartTime(bookingDate, bookingTime);
  return Number.isFinite(bookingStart)
    && now >= bookingStart
    && now < bookingStart + CHECK_IN_WINDOW_MS;
}
