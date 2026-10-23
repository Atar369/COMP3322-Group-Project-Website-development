import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';

// serving → finished → paid display order
const SESSION_STATUS_PRIORITY = { serving: 0, finished: 1, paid: 2 };

export default function ManagerOrders() {
  const [orders, setOrders] = useState([]);

  const load = useCallback(() => {
    api.get('/orders').then(r => setOrders(Array.isArray(r.data) ? r.data : [])).catch(() => setOrders([]));
  }, []);

  useEffect(load, [load]);

  // Derive session status from the linked booking or queue
  function getSessionStatus(o) {
    return o.booking_status || o.queue_status || null;
  }

  async function handleMarkPaid(o) {
    try {
      if (o.booking_id) await api.patch(`/booking/${o.booking_id}/pay`);
      else if (o.queue_id) await api.patch(`/queue/${o.queue_id}/pay`);
      load();
    } catch { /* ignore */ }
  }

  // Show serving, finished, and paid sessions
  const visible = orders
    .filter(o => {
      const s = getSessionStatus(o);
      return s === 'serving' || s === 'finished' || s === 'paid' || o.payment_status === 'paid';
    })
    .sort((a, b) => {
      const aS = SESSION_STATUS_PRIORITY[getSessionStatus(a)] ?? 9;
      const bS = SESSION_STATUS_PRIORITY[getSessionStatus(b)] ?? 9;
      if (aS !== bS) return aS - bS;
      return new Date(a.order_time) - new Date(b.order_time);
    });

  return (
    <div className="page" style={{ maxWidth: 900 }}>
      <h1>Orders</h1>
      <p style={{ color: '#6b6558', fontSize: '0.85rem', marginBottom: 20 }}>
        Active and recently finished orders. Click <strong>Mark as Paid</strong> after collecting payment.
      </p>

      {visible.length === 0 && <p style={{ color: '#6b6558' }}>No active orders at this time.</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {visible.map(o => {
          const sessionStatus = getSessionStatus(o);
          const isPaid = o.payment_status === 'paid';

          return (
            <div key={o.order_id} className="order-card">
              {/* Left: order details */}
              <div className="order-card-left">
                <div style={{ fontSize: '1.5rem' }}>🧾</div>
                <div>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.05rem' }}>
                    Order #{o.order_id}
                  </div>
                  <div style={{ color: '#6b6558', fontSize: '0.85rem', marginTop: 2 }}>
                    ${Number(o.total_amount).toFixed(2)} · {o.order_time?.slice(0, 16).replace('T', ' ')}
                  </div>
                  {o.booking_id && (
                    <div style={{ color: '#6b6558', fontSize: '0.82rem', marginTop: 2 }}>
                      📋 Booking #{o.booking_id}{o.table_number ? ` — Table #${o.table_number}` : ''}, party of {o.booking_party}
                    </div>
                  )}
                  {o.queue_id && (
                    <div style={{ color: '#6b6558', fontSize: '0.82rem', marginTop: 2 }}>
                      🔢 Queue #{o.queue_id} — party of {o.queue_party}
                    </div>
                  )}
                </div>
              </div>

              {/* Right: status badge + action */}
              <div className="order-card-right">
                {isPaid ? (
                  <span className="badge completed" style={{ padding: '4px 12px' }}>Paid ✓</span>
                ) : sessionStatus === 'serving' ? (
                  <span className="order-btn serving">Serving</span>
                ) : sessionStatus === 'finished' ? (
                  <>
                    <span className="badge cancelled" style={{ padding: '4px 12px', marginBottom: 8 }}>Finished</span>
                    <button className="order-btn pay" onClick={() => handleMarkPaid(o)}>Mark as Paid</button>
                  </>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
