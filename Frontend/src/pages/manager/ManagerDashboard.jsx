import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { dashboardStats, getTodayPaidOrders } from '../../data/mockData';

export default function ManagerDashboard() {
  const { revenueTrend, bestSellers, ordersByHour } = dashboardStats;
  const paidOrders = getTodayPaidOrders();
  const todayRevenue = paidOrders.reduce((sum, o) => sum + o.total_amount, 0);

  return (
    <div className="page">
      <h1>Dashboard</h1>
      <div className="stat" style={{ marginBottom: 20, maxWidth: 220 }}>
        <div className="num">${todayRevenue}</div>
        <div className="label">Today's revenue (from paid orders)</div>
      </div>

      <div className="dash-grid">
        <div className="card">
          <h3>Revenue trend (7 days)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={revenueTrend}>
              <CartesianGrid stroke="#ddd6c6" />
              <XAxis dataKey="day" stroke="#211f1b" fontSize={12} />
              <YAxis stroke="#211f1b" fontSize={12} />
              <Tooltip />
              <Line type="monotone" dataKey="revenue" stroke="#24463a" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3>Best-selling dishes</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={bestSellers}>
              <CartesianGrid stroke="#ddd6c6" />
              <XAxis dataKey="name" stroke="#211f1b" fontSize={10} />
              <YAxis stroke="#211f1b" fontSize={12} />
              <Tooltip />
              <Bar dataKey="qty" fill="#d9a441" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card" style={{ gridColumn: '1 / -1' }}>
          <h3>Orders by hour (peak hours)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={ordersByHour}>
              <CartesianGrid stroke="#ddd6c6" />
              <XAxis dataKey="hour" stroke="#211f1b" fontSize={12} />
              <YAxis stroke="#211f1b" fontSize={12} />
              <Tooltip />
              <Bar dataKey="orders" fill="#24463a" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
