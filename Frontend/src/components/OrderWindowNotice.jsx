export default function OrderWindowNotice({ orderWindow }) {
  if (!orderWindow || !orderWindow.hasOrderContext) return null;

  if (orderWindow.loading) {
    return <p style={{ color: '#6b6558', fontSize: '0.85rem' }}>Checking the last-order time…</p>;
  }
  if (orderWindow.error) {
    return <p className="error-text">{orderWindow.error}</p>;
  }

  return (
    <div style={{ fontSize: '0.85rem', fontWeight: 600, margin: '12px 0' }}>
      {orderWindow.beforeOpening ? (
        <p style={{ color: 'var(--rust)', margin: 0 }}>Order placement opens at 10:00 AM.</p>
      ) : orderWindow.cutoffReached ? (
        <p style={{ color: 'var(--rust)', margin: 0 }}>Order placement ends at 9:45 PM.</p>
      ) : orderWindow.orderWindowEnded ? (
        <p style={{ color: 'var(--rust)', margin: 0 }}>Last order ended</p>
      ) : (
        <p style={{ color: 'var(--green)', margin: 0 }}>
          {orderWindow.countdown}
        </p>
      )}
    </div>
  );
}
