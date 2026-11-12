const db = require('../db');
const { getRestaurantDateKey } = require('../utils/restaurantTime');

const MAX_RANGE_DAYS = 366;
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isValidDateKey(value) {
  if (typeof value !== 'string' || !DATE_KEY_PATTERN.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

function addDays(dateKey, days) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

function hongKongDateStartUtc(dateKey) {
  return new Date(`${dateKey}T00:00:00+08:00`).toISOString().slice(0, 19).replace('T', ' ');
}

function dayCount(startDate, endDate) {
  const [sy, sm, sd] = startDate.split('-').map(Number);
  const [ey, em, ed] = endDate.split('-').map(Number);
  return (Date.UTC(ey, em - 1, ed) - Date.UTC(sy, sm - 1, sd)) / 86400000 + 1;
}

async function dashboardData(request, response) {
  try {
    const today = getRestaurantDateKey();
    const startDate = request.query.startDate;
    const endDate = request.query.endDate;

    if (!isValidDateKey(startDate) || !isValidDateKey(endDate)) {
      return response.status(400).json({ error: 'Select a valid start and end date.' });
    }
    if (startDate > endDate) {
      return response.status(400).json({ error: 'The start date must be on or before the end date.' });
    }
    if (endDate > today) {
      return response.status(400).json({ error: 'The end date cannot be in the future.' });
    }
    if (dayCount(startDate, endDate) > MAX_RANGE_DAYS) {
      return response.status(400).json({ error: 'Select a period of no more than 366 days.' });
    }

    const startUtc = hongKongDateStartUtc(startDate);
    const endUtc = hongKongDateStartUtc(addDays(endDate, 1));
    const queryParams = [startUtc, endUtc];
    const [
      [summaryRows],
      [revenueRows],
      [topItemRows],
      [hourRows],
    ] = await Promise.all([
      db.query(
        `SELECT COALESCE(SUM(total_amount), 0.00) AS revenue, COUNT(*) AS paidOrders
         FROM orders
         WHERE order_time >= ? AND order_time < ? AND payment_status = 'paid'`,
        queryParams
      ),
      db.query(
        `SELECT DATE(DATE_ADD(order_time, INTERVAL 8 HOUR)) AS date,
                COALESCE(SUM(total_amount), 0.00) AS revenue
         FROM orders
         WHERE order_time >= ? AND order_time < ? AND payment_status = 'paid'
         GROUP BY DATE(DATE_ADD(order_time, INTERVAL 8 HOUR))
         ORDER BY date`,
        queryParams
      ),
      db.query(
        `SELECT m.name AS name, SUM(oi.quantity) AS qty
         FROM order_items oi
         JOIN orders o ON o.order_id = oi.order_id
         JOIN menu_items m ON m.item_id = oi.item_id
         WHERE o.order_time >= ? AND o.order_time < ? AND o.payment_status = 'paid'
         GROUP BY m.item_id, m.name
         ORDER BY qty DESC, m.name ASC
         LIMIT 4`,
        queryParams
      ),
      db.query(
        `SELECT HOUR(DATE_ADD(order_time, INTERVAL 8 HOUR)) AS hour, COUNT(*) AS orders
         FROM orders
         WHERE order_time >= ? AND order_time < ?
           AND HOUR(DATE_ADD(order_time, INTERVAL 8 HOUR)) >= 10
           AND HOUR(DATE_ADD(order_time, INTERVAL 8 HOUR)) < 22
         GROUP BY HOUR(DATE_ADD(order_time, INTERVAL 8 HOUR))
         ORDER BY hour`,
        queryParams
      ),
    ]);

    return response.status(200).json({
      success: true,
      data: {
        metadata: { startDate, endDate, generatedAt: new Date().toISOString() },
        summary: {
          revenue: Number(summaryRows[0]?.revenue || 0),
          paidOrders: Number(summaryRows[0]?.paidOrders || 0),
          topSellingItem: topItemRows.length
            ? { name: topItemRows[0].name, qty: Number(topItemRows[0].qty) }
            : null,
        },
        charts: {
          revenueTrend: revenueRows.map(row => ({ date: row.date, revenue: Number(row.revenue) })),
          topItems: topItemRows.map(row => ({ name: row.name, qty: Number(row.qty) })),
          ordersByHour: hourRows.map(row => ({ hour: Number(row.hour), orders: Number(row.orders) })),
        },
      },
    });
  } catch (error) {
    console.error('Dashboard data error:', error);
    return response.status(500).json({ error: 'Unable to load dashboard data right now.' });
  }
}

module.exports = { dashboardData, isValidDateKey, dayCount };
