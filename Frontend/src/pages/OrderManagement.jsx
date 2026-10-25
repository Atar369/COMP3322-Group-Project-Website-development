import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import api from '../services/api';
import { formatOrderWindowCountdown, getOrderWindowStatus, isLastOrderCutoffReached } from '../utils/orderingWindow';
import Pagination, { usePagination } from '../components/Pagination';

function useNow() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function OrderTimer({ servedAt, now, cutoffReached }) {
  const { ended, remainingMs } = getOrderWindowStatus(servedAt, now);
  return (
    <div style={{ fontSize: '0.78rem', fontWeight: 600 }}>
      <div style={{ color: ended || cutoffReached ? 'var(--rust)' : 'var(--green)' }}>
        {ended ? 'Last order ended' : formatOrderWindowCountdown(remainingMs)}
      </div>
      {cutoffReached && (
        <div style={{ color: 'var(--rust)' }}>Order placement is closed for the day after 21:00.</div>
      )}
    </div>
  );
}

export default function OrderManagement() {
  const { user } = useAuth();
  const { items, setOrderContext } = useCart();
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [queues, setQueues] = useState([]);
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState('');
  const now = useNow();

  const load = useCallback(() => {
    if (!user) return;
    fetch(`/api/booking/user/${user.user_id}`)
      .then(r => r.json())
      .then(d => setBookings(Array.isArray(d) ? d.filter(b => ['serving', 'finished'].includes(b.status)) : []))
      .catch(() => setBookings([]));
    api.get(`/queue/user/${user.user_id}`)
      .then(r => setQueues(Array.isArray(r.data) ? r.data.filter(q => ['serving', 'finished'].includes(q.status)) : []))
      .catch(() => setQueues([]));
    setOrdersLoading(true);
    setOrdersError('');
    api.get(`/orders/user/${user.user_id}`)
      .then(r => {
        setOrders(Array.isArray(r.data) ? r.data : []);
        setOrdersLoading(false);
      })
      .catch(() => {
        setOrders([]);
        setOrdersLoading(false);
        setOrdersError('Unable to load the accumulated total. Please retry.');
      });
  }, [user]);

  useEffect(load, [load]);

  function handleOrder(type, id) {
    if (isLastOrderCutoffReached() || !id) return;
    setOrderContext({
      type,
      bookingId: type === 'booking' ? id : null,
      queueId: type === 'queue' ? id : null,
    });
    navigate('/menu');
  }

  function handleOpenCart(type, id) {
    if (!id) return;
    setOrderContext({
      type,
      bookingId: type === 'booking' ? id : null,
      queueId: type === 'queue' ? id : null,
    });
    navigate('/cart');
  }

  async function handleRequestPayment(sessions) {
    const results = await Promise.allSettled(sessions.map(session => (
      session.type === 'booking'
        ? api.patch(`/booking/${session.id}/finish`)
        : api.patch(`/queue/${session.id}/finish`)
    )));
    load();
    if (results.some(result => result.status === 'rejected')) {
      window.alert('Failed to request payment. Please try again.');
    }
  }

  const cartCount = items.reduce((n, i) => n + i.qty, 0);
  const cutoffReached = isLastOrderCutoffReached(new Date(now));

  function servingButtons(sessions, servedAt, totalLabel) {
    const { ended: isOrderWindowClosed } = getOrderWindowStatus(servedAt, now);
    const orderDisabled = isOrderWindowClosed || cutoffReached;

    return (
      <>
        <div className="orders-cart-actions">
          <div className="orders-cart-action-buttons">
            <button
              className="order-btn serving"
              style={{ cursor: orderDisabled ? 'not-allowed' : 'pointer', minWidth: 80, opacity: orderDisabled ? 0.5 : 1 }}
              onClick={() => orderDisabled ? null : handleOrder(sessions[0].type, sessions[0].id)}
              disabled={orderDisabled}
            >
              Order
            </button>
            <button
              className="btn secondary"
              style={{ padding: '5px 10px', fontSize: '0.8rem', position: 'relative', cursor: isOrderWindowClosed ? 'not-allowed' : 'pointer', opacity: isOrderWindowClosed ? 0.5 : 1 }}
              onClick={() => isOrderWindowClosed ? null : handleOpenCart(sessions[0].type, sessions[0].id)}
              disabled={isOrderWindowClosed}
              title="View cart"
            >
              Cart{cartCount > 0 && ` (${cartCount})`}
            </button>
          </div>
          <strong className="orders-cart-total">{totalLabel}</strong>
          <button
            className="btn"
            style={{ padding: '6px 10px', fontSize: '0.8rem', background: 'var(--mustard)', color: 'var(--ink)' }}
            onClick={() => handleRequestPayment(sessions)}
          >
            Request Payment
          </button>
        </div>
        <OrderTimer servedAt={servedAt} now={now} cutoffReached={cutoffReached} />
      </>
    );
  }

  const cardsByKey = new Map();
  for (const booking of bookings) {
    const key = `table-${booking.table_id}`;
    const card = cardsByKey.get(key) || { key, tableId: booking.table_id, bookings: [], queues: [] };
    card.bookings.push(booking);
    cardsByKey.set(key, card);
  }
  for (const queue of queues) {
    const key = `queue-${queue.queue_id}`;
    cardsByKey.set(key, { key, tableId: null, bookings: [], queues: [queue] });
  }

  const cards = [...cardsByKey.values()];
  const pagination = usePagination(cards);
  const hasAnything = cards.length > 0;

  return (
    <div className="page" style={{ maxWidth: 1100 }}>
      <h1>Orders & Cart</h1>
      <p style={{ color: '#6b6558', fontSize: '0.88rem', marginBottom: 20 }}>
        Orders from seated tables and queue parties. Request payment when you are ready to pay.
      </p>
      {ordersError && (
        <p className="error-text">
          {ordersError} <button className="btn secondary" onClick={load}>Retry</button>
        </p>
      )}

      {!hasAnything && (
        <p>No seated tables or queue parties yet.</p>
      )}

      <div className="orders-cart-list" data-pagination-anchor>
        {pagination.pageItems.map(card => {
          const cardBookings = card.bookings;
          const cardQueues = card.queues;
          const servingSessions = [
            ...cardBookings.filter(b => b.status === 'serving').map(b => ({ type: 'booking', id: b.booking_id, servedAt: b.served_at })),
            ...cardQueues.filter(q => q.status === 'serving').map(q => ({ type: 'queue', id: q.queue_id, servedAt: q.served_at })),
          ];
          const servingSession = servingSessions[0];
          const cardOrders = orders.filter(order => (
            card.tableId !== null
              ? Number(order.table_id) === Number(card.tableId)
              : cardBookings.some(b => Number(order.booking_id) === Number(b.booking_id))
                || cardQueues.some(q => Number(order.queue_id) === Number(q.queue_id))
          ));
          const total = cardOrders.reduce((sum, order) => sum + Math.round(Number(order.total_amount) * 100), 0) / 100;
          const totalLabel = ordersError
            ? 'Accumulated total unavailable'
            : ordersLoading
              ? 'Loading accumulated total…'
              : `Accumulated Total: $${total.toFixed(2)}`;
          return (
            <div key={card.key} className="order-card orders-cart-card">
              <div className="orders-cart-primary">
                <strong>{card.tableId !== null ? `Table ${card.tableId}` : `Queue #${cardQueues[0]?.queue_id}`}</strong>
                {ordersError
                  ? <span className="orders-cart-order">Order details unavailable</span>
                  : ordersLoading
                    ? <span className="orders-cart-order">Loading orders…</span>
                    : cardOrders.length > 0
                  ? cardOrders.map(order => (
                    <span key={order.order_id} className="orders-cart-order">
                      Order #{order.order_id} · ${Number(order.total_amount).toFixed(2)}
                    </span>
                  ))
                    : <span className="orders-cart-order">No orders placed yet</span>}
              </div>

              <div className="orders-cart-details">
                {cardBookings.map(b => (
                  <div key={`booking-${b.booking_id}`}>
                    {b.booking_date?.slice(0, 10)} {b.booking_time?.slice(0, 5)} · Party of {b.party_size}
                    {b.special_request && <div className="orders-cart-request">"{b.special_request}"</div>}
                  </div>
                ))}
                {cardQueues.map(q => (
                  <div key={`queue-${q.queue_id}`}>
                    Joined {q.joined_at?.slice(11, 16)} · Party of {q.party_size}
                  </div>
                ))}
              </div>

              <div className="orders-cart-control">
                {servingSession
                  ? servingButtons(servingSessions, servingSession.servedAt, totalLabel)
                  : <>
                    <strong className="orders-cart-completed">Completed, please wait for manager to settle payment.</strong>
                    <strong className="orders-cart-total">{totalLabel}</strong>
                  </>}
              </div>
            </div>
          );
        })}
      </div>
      <Pagination
        page={pagination.page}
        pageCount={pagination.pageCount}
        totalItems={cards.length}
        onPageChange={pagination.setPage}
      />
    </div>
  );
}
