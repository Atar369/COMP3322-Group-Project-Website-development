const STEPS = ['pending', 'preparing', 'ready', 'arrived', 'pay now'];

export default function OrderStatusTracker({ status }) {
  const currentIndex = STEPS.indexOf(status);
  return (
    <div className="status-track">
      {STEPS.map((step, i) => (
        <div key={step} className={`step ${i <= currentIndex ? 'active' : ''}`}>
          {step}
        </div>
      ))}
    </div>
  );
}
