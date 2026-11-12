import { useEffect, useMemo, useState } from 'react';
import { Area, AreaChart, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import api from '../../services/api';
import { getRestaurantDateKey } from '../../utils/restaurantTime';

function shiftDate(dateKey, days) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

function formatDate(dateKey, options = { day: 'numeric', month: 'short' }) {
  return new Intl.DateTimeFormat('en-HK', { ...options, timeZone: 'UTC' })
    .format(new Date(`${dateKey}T12:00:00Z`));
}

function formatHour(hour) {
  const suffix = hour < 12 ? 'am' : 'pm';
  const displayHour = hour % 12 || 12;
  return `${displayHour}${suffix}`;
}

function wrapDishName(name, maxLineLength = 16) {
  const words = String(name).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';

  words.forEach(word => {
    while (word.length > maxLineLength) {
      if (line) {
        lines.push(line);
        line = '';
      }
      lines.push(word.slice(0, maxLineLength));
      word = word.slice(maxLineLength);
    }

    if (line && `${line} ${word}`.length > maxLineLength) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  });

  if (line) lines.push(line);
  return lines;
}

function DishNameTick({ x, y, payload }) {
  return (
    <text x={x} y={y + 12} textAnchor="middle" fill="#817c71" fontSize={9}>
      {wrapDishName(payload.value).map((line, index) => (
        <tspan key={`${line}-${index}`} x={x} dy={index === 0 ? 0 : 11}>{line}</tspan>
      ))}
    </text>
  );
}

function createDateRange(startDate, endDate, revenueRows) {
  const revenueByDate = new Map(revenueRows.map(row => [row.date, row.revenue]));
  const days = [];
  for (let date = startDate; date <= endDate; date = shiftDate(date, 1)) {
    days.push({ day: formatDate(date), revenue: revenueByDate.get(date) || 0 });
  }
  return days;
}

function countDateRangeDays(startDate, endDate) {
  return (Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 86400000 + 1;
}

export default function ManagerDashboard() {
  const today = getRestaurantDateKey();
  const defaultStart = shiftDate(today, -6);
  const [draftStart, setDraftStart] = useState(defaultStart);
  const [draftEnd, setDraftEnd] = useState(today);
  const [dateRange, setDateRange] = useState({ startDate: defaultStart, endDate: today });
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rangeError, setRangeError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');

    api.get('/manager/dashboard', { params: dateRange })
      .then(response => {
        if (active) setDashboard(response.data.data);
      })
      .catch(requestError => {
        if (active) {
          setError(requestError.response?.data?.error || 'Unable to load dashboard data. Please try again.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [dateRange]);

  const revenueTrend = useMemo(
    () => createDateRange(dateRange.startDate, dateRange.endDate, dashboard?.charts.revenueTrend || []),
    [dateRange, dashboard]
  );
  const bestSellers = dashboard?.charts.topItems || [];
  const ordersByHour = useMemo(() => {
    const periodDays = countDateRangeDays(dateRange.startDate, dateRange.endDate);
    const ordersBySelectedHour = new Map(
      (dashboard?.charts.ordersByHour || []).map(row => [row.hour, row.orders])
    );
    return Array.from({ length: 12 }, (_, index) => {
      const hour = index + 10;
      return {
        hour: formatHour(hour),
        orders: (ordersBySelectedHour.get(hour) || 0) / periodDays,
      };
    });
  }, [dateRange, dashboard]);
  const summary = dashboard?.summary;
  const periodLabel = `${formatDate(dateRange.startDate, { day: 'numeric', month: 'long', year: 'numeric' })} – ${formatDate(dateRange.endDate, { day: 'numeric', month: 'long', year: 'numeric' })}`;

  function applyDateRange(event) {
    event.preventDefault();
    setRangeError('');
    if (!draftStart || !draftEnd) {
      setRangeError('Choose both a start date and an end date.');
      return;
    }
    if (draftStart > draftEnd) {
      setRangeError('The start date must be on or before the end date.');
      return;
    }
    if (draftEnd > today) {
      setRangeError('The end date cannot be in the future.');
      return;
    }
    if ((Date.parse(`${draftEnd}T00:00:00Z`) - Date.parse(`${draftStart}T00:00:00Z`)) / 86400000 + 1 > 366) {
      setRangeError('Choose a period of no more than 366 days.');
      return;
    }
    setDateRange({ startDate: draftStart, endDate: draftEnd });
  }

  return (
    <main className="page manager-dashboard-page">
      <header className="manager-dashboard-heading">
        <div>
          <span className="manager-dashboard-eyebrow">EMBER &amp; OAK · MANAGEMENT</span>
          <h1>Dashboard</h1>
          <p>Explore service performance across a selected date range.</p>
        </div>
        <div className="manager-dashboard-date">
          <span>SELECTED PERIOD</span>
          <strong>{periodLabel}</strong>
        </div>
      </header>

      <form className="manager-dashboard-date-filter" onSubmit={applyDateRange}>
        <label>
          <span>From</span>
          <input
            type="date"
            value={draftStart}
            max={draftEnd || today}
            onChange={event => setDraftStart(event.target.value)}
            required
          />
        </label>
        <label>
          <span>To</span>
          <input
            type="date"
            value={draftEnd}
            min={draftStart || undefined}
            max={today}
            onChange={event => setDraftEnd(event.target.value)}
            required
          />
        </label>
        <button className="btn" type="submit" disabled={loading}>Apply dates</button>
        <span className="manager-dashboard-filter-hint">Up to 366 days · Hong Kong dates</span>
        {rangeError && <p className="manager-dashboard-error" role="alert">{rangeError}</p>}
      </form>

      {error && <p className="manager-dashboard-error" role="alert">{error}</p>}

      {loading && <p className="manager-dashboard-loading" role="status">Loading dashboard…</p>}

      {!loading && !error && summary && (
        <>
          <section className="manager-dashboard-overview" aria-label="Business overview">
            <article className="manager-revenue-feature">
              <div className="manager-revenue-feature-top">
                <span className="manager-dashboard-eyebrow">PAID REVENUE IN PERIOD</span>
                <span className="manager-revenue-icon" aria-hidden="true">↗</span>
              </div>
              <div className="manager-revenue-amount">${summary.revenue.toLocaleString('en-HK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              <p>{periodLabel}</p>
              <div className="manager-revenue-feature-bottom">
                <span className="manager-revenue-mark" aria-hidden="true">✦</span>
                Revenue from completed payments
              </div>
            </article>

            <article className="manager-dashboard-stat">
              <span className="manager-dashboard-stat-icon" aria-hidden="true">01</span>
              <span className="manager-dashboard-eyebrow">PAID ORDERS</span>
              <strong>{summary.paidOrders.toLocaleString('en-HK')}</strong>
              <span className="manager-dashboard-stat-note">in selected period</span>
            </article>

            <article className="manager-dashboard-stat manager-dashboard-stat-accent">
              <span className="manager-dashboard-stat-icon" aria-hidden="true">02</span>
              <span className="manager-dashboard-eyebrow">TOP SELLING DISH</span>
              <strong className="manager-dashboard-stat-dish">{summary.topSellingItem?.name || 'No sales'}</strong>
              <span className="manager-dashboard-stat-note">
                {summary.topSellingItem ? `${summary.topSellingItem.qty} sold in selected period` : 'No paid items in this period'}
              </span>
            </article>

            <article className="manager-dashboard-stat">
              <span className="manager-dashboard-stat-icon" aria-hidden="true">03</span>
              <span className="manager-dashboard-eyebrow">DATE RANGE</span>
              <strong className="manager-dashboard-stat-dish">{periodLabel}</strong>
              <span className="manager-dashboard-stat-note">all dates use Hong Kong time</span>
            </article>
          </section>

          <div className="manager-dashboard-section-heading">
            <div>
              <span className="manager-dashboard-eyebrow">PERFORMANCE</span>
              <h2>Service at a glance</h2>
            </div>
            <span className="manager-dashboard-section-rule" aria-hidden="true" />
          </div>

          <section className="manager-dashboard-charts" aria-label="Performance charts">
            <article className="manager-dashboard-chart manager-dashboard-chart-revenue">
              <div className="manager-dashboard-chart-heading">
                <div>
                  <span className="manager-dashboard-eyebrow">SELECTED PERIOD</span>
                  <h3>Revenue trend</h3>
                </div>
                <span className="manager-dashboard-chart-tag">{revenueTrend.length} DAYS</span>
              </div>
              <ResponsiveContainer width="100%" height={248}>
                <AreaChart data={revenueTrend} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="managerRevenueFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#d9a441" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#d9a441" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#e9e4da" strokeDasharray="3 5" vertical={false} />
                  <XAxis dataKey="day" axisLine={false} tickLine={false} stroke="#817c71" fontSize={11} minTickGap={24} />
                  <YAxis axisLine={false} tickLine={false} stroke="#817c71" fontSize={11} width={46} />
                  <Tooltip formatter={value => [`$${Number(value).toFixed(2)}`, 'Revenue']} />
                  <Area type="monotone" dataKey="revenue" stroke="#a77a2c" strokeWidth={3} fill="url(#managerRevenueFill)" activeDot={{ r: 5, fill: '#8e6727', stroke: '#fff', strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            </article>

            <article className="manager-dashboard-chart">
              <div className="manager-dashboard-chart-heading">
                <div>
                  <span className="manager-dashboard-eyebrow">GUEST FAVORITES</span>
                  <h3>Best-selling dishes</h3>
                </div>
                <span className="manager-dashboard-chart-mark" aria-hidden="true">✳</span>
              </div>
              {bestSellers.length === 0 ? (
                <p className="manager-dashboard-empty">No paid dish sales in this period.</p>
              ) : (
                <ResponsiveContainer width="100%" height={276}>
                  <BarChart data={bestSellers} margin={{ top: 12, right: 4, left: -18, bottom: 0 }}>
                    <CartesianGrid stroke="#e9e4da" strokeDasharray="3 5" vertical={false} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} interval={0} height={58} tick={<DishNameTick />} />
                    <YAxis axisLine={false} tickLine={false} stroke="#817c71" fontSize={11} />
                    <Tooltip />
                    <Bar dataKey="qty" name="Sold" fill="#c4974d" radius={[5, 5, 0, 0]} maxBarSize={34} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </article>

            <article className="manager-dashboard-chart manager-dashboard-chart-hours">
              <div className="manager-dashboard-chart-heading">
                <div>
                  <span className="manager-dashboard-eyebrow">DINING RHYTHM</span>
                  <h3>Average orders by hour</h3>
                  <p className="manager-dashboard-chart-description">Average orders in each hour per day across the selected period.</p>
                </div>
                <span className="manager-dashboard-chart-tag">10 AM–10 PM · DAILY AVG.</span>
              </div>
              <ResponsiveContainer width="100%" height={218}>
                <BarChart data={ordersByHour} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="#e9e4da" strokeDasharray="3 5" vertical={false} />
                  <XAxis dataKey="hour" axisLine={false} tickLine={false} stroke="#817c71" fontSize={10} interval={0} />
                  <YAxis axisLine={false} tickLine={false} stroke="#817c71" fontSize={11} width={32} />
                  <Tooltip formatter={value => [Number(value).toFixed(1), 'Avg. orders per day']} />
                  <Bar dataKey="orders" fill="#6c6251" radius={[5, 5, 0, 0]} maxBarSize={42} />
                </BarChart>
              </ResponsiveContainer>
            </article>
          </section>
        </>
      )}
    </main>
  );
}
