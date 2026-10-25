import { useEffect, useState } from 'react';
import api from '../services/api';
import { formatOrderWindowCountdown, getOrderWindowStatus, isLastOrderCutoffReached } from '../utils/orderingWindow';

export default function useOrderWindow(user, orderContext, enabled = true) {
  const [session, setSession] = useState({ loading: false, servedAt: null, status: null, error: '' });
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!enabled) return undefined;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [enabled]);

  useEffect(() => {
    let active = true;
    if (!enabled || !user || !orderContext) {
      setSession({ loading: false, servedAt: null, status: null, error: '' });
      return () => { active = false; };
    }

    const endpoint = orderContext.type === 'booking' ? 'booking' : 'queue';
    const sessionId = orderContext.type === 'booking' ? orderContext.bookingId : orderContext.queueId;
    setSession({ loading: true, servedAt: null, status: null, error: '' });
    api.get(`/${endpoint}/user/${user.user_id}`)
      .then(response => {
        if (!active) return;
        const entries = Array.isArray(response.data) ? response.data : [];
        const match = entries.find(entry => Number(entry[`${endpoint}_id`]) === Number(sessionId));
        if (!match || !match.served_at) {
          setSession({ loading: false, servedAt: null, status: null, error: 'Unable to verify this seated session. Please return to Orders & Cart.' });
          return;
        }
        setSession({ loading: false, servedAt: match.served_at, status: match.status, error: '' });
      })
      .catch(() => {
        if (active) {
          setSession({ loading: false, servedAt: null, status: null, error: 'Unable to verify the last-order time. Please retry.' });
        }
      });

    return () => { active = false; };
  }, [enabled, user, orderContext]);

  const windowStatus = session.servedAt
    ? getOrderWindowStatus(session.servedAt, now)
    : { remainingMs: 0, ended: false };
  const orderWindowEnded = windowStatus.ended || (session.status && session.status !== 'serving');
  const cutoffReached = isLastOrderCutoffReached(new Date(now));
  return {
    ...session,
    hasOrderContext: Boolean(enabled && orderContext),
    cutoffReached,
    orderWindowEnded,
    countdown: session.servedAt && session.status === 'serving' && !windowStatus.ended
      ? formatOrderWindowCountdown(windowStatus.remainingMs)
      : null,
    canOrder: Boolean(enabled && orderContext && session.servedAt && session.status === 'serving' && !windowStatus.ended && !cutoffReached),
  };
}
