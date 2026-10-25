import { Area, AreaChart, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { dashboardStats, getTodayPaidOrders } from '../../data/mockData';

export default function ManagerDashboard() {
  const { revenueTrend, bestSellers, ordersByHour } = dashboardStats;
  const paidOrders = getTodayPaidOrders();
  const todayRevenue = paidOrders.reduce((sum, o) => sum + o.total_amount, 0);
  const weeklyRevenue = revenueTrend.reduce((sum, day) => sum + day.revenue, 0);
  const topSeller = [...bestSellers].sort((a, b) => b.qty - a.qty)[0];
  const today = new Intl.DateTimeFormat('en-HK', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date());

  return (
    <main className="page manager-dashboard-page">
      <header className="manager-dashboard-heading">
        <div>
          <span className="manager-dashboard-eyebrow">EMBER &amp; OAK · MANAGEMENT</span>
          <h1>Dashboard</h1>
          <p>A clear view of today’s service and the week’s performance.</p>
        </div>
        <div className="manager-dashboard-date">
          <span>OPERATING SNAPSHOT</span>
          <strong>{today}</strong>
        </div>
      </header>

      <section className="manager-dashboard-overview" aria-label="Business overview">
        <article className="manager-revenue-feature">
          <div className="manager-revenue-feature-top">
            <span className="manager-dashboard-eyebrow">TODAY’S PAID REVENUE</span>
            <span className="manager-revenue-icon" aria-hidden="true">↗</span>
          </div>
          <div className="manager-revenue-amount">${todayRevenue.toLocaleString('en-HK')}</div>
          <p>Settled orders recorded today</p>
          <div className="manager-revenue-feature-bottom">
            <span className="manager-revenue-mark" aria-hidden="true">✦</span>
            Revenue from completed payments
          </div>
        </article>

        <article className="manager-dashboard-stat">
          <span className="manager-dashboard-stat-icon" aria-hidden="true">01</span>
          <span className="manager-dashboard-eyebrow">PAID ORDERS TODAY</span>
          <strong>{paidOrders.length}</strong>
          <span className="manager-dashboard-stat-note">settled orders</span>
        </article>

        <article className="manager-dashboard-stat manager-dashboard-stat-accent">
          <span className="manager-dashboard-stat-icon" aria-hidden="true">02</span>
          <span className="manager-dashboard-eyebrow">TOP SELLING DISH</span>
          <strong className="manager-dashboard-stat-dish">{topSeller?.name || 'No sales yet'}</strong>
          <span className="manager-dashboard-stat-note">{topSeller ? `${topSeller.qty} sold this week` : 'Weekly dish performance'}</span>
        </article>

        <article className="manager-dashboard-stat">
          <span className="manager-dashboard-stat-icon" aria-hidden="true">03</span>
          <span className="manager-dashboard-eyebrow">7-DAY REVENUE</span>
          <strong>${weeklyRevenue.toLocaleString('en-HK')}</strong>
          <span className="manager-dashboard-stat-note">across the past week</span>
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
              <span className="manager-dashboard-eyebrow">WEEKLY OVERVIEW</span>
              <h3>Revenue trend</h3>
            </div>
            <span className="manager-dashboard-chart-tag">7 DAYS</span>
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
              <XAxis dataKey="day" axisLine={false} tickLine={false} stroke="#817c71" fontSize={11} />
              <YAxis axisLine={false} tickLine={false} stroke="#817c71" fontSize={11} width={46} />
              <Tooltip />
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
          <ResponsiveContainer width="100%" height={248}>
            <BarChart data={bestSellers} margin={{ top: 12, right: 4, left: -18, bottom: 0 }}>
              <CartesianGrid stroke="#e9e4da" strokeDasharray="3 5" vertical={false} />
              <XAxis dataKey="name" axisLine={false} tickLine={false} stroke="#817c71" fontSize={9} />
              <YAxis axisLine={false} tickLine={false} stroke="#817c71" fontSize={11} />
              <Tooltip />
              <Bar dataKey="qty" fill="#c4974d" radius={[5, 5, 0, 0]} maxBarSize={34} />
            </BarChart>
          </ResponsiveContainer>
        </article>

        <article className="manager-dashboard-chart manager-dashboard-chart-hours">
          <div className="manager-dashboard-chart-heading">
            <div>
              <span className="manager-dashboard-eyebrow">DINING RHYTHM</span>
              <h3>Orders by hour</h3>
            </div>
            <span className="manager-dashboard-chart-tag">PEAK HOURS</span>
          </div>
          <ResponsiveContainer width="100%" height={218}>
            <BarChart data={ordersByHour} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#e9e4da" strokeDasharray="3 5" vertical={false} />
              <XAxis dataKey="hour" axisLine={false} tickLine={false} stroke="#817c71" fontSize={11} />
              <YAxis axisLine={false} tickLine={false} stroke="#817c71" fontSize={11} width={32} />
              <Tooltip />
              <Bar dataKey="orders" fill="#6c6251" radius={[5, 5, 0, 0]} maxBarSize={42} />
            </BarChart>
          </ResponsiveContainer>
        </article>
      </section>
    </main>
  );
}
