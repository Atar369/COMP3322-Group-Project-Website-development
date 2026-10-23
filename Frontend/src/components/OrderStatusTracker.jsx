const STEPS = ['serving', 'finished', 'paid'];
const STEP_LABELS = { serving: 'Serving', finished: 'Finished', paid: 'Paid' };

export default function OrderStatusTracker({ status }) {
  const currentIndex = STEPS.indexOf(status);
  return (
    <div className="status-track">
      {STEPS.map((step, i) => (
        <div key={step} className={`step ${i <= currentIndex ? 'active' : ''}`}>
          {STEP_LABELS[step]}
        </div>
      ))}
    </div>
  );
}
