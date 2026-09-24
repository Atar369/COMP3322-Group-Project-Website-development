import { queue_entries } from '../data/mockData';
import { useAuth } from '../context/AuthContext';

export default function QueueHistory() {
  const { user } = useAuth();
  const userQueues = queue_entries.filter(q => q.user_id === user.user_id);

  return (
    <div className="page">
      <h1>Queue History</h1>
      {userQueues.length === 0 ? (
        <p>No queue entries yet.</p>
      ) : (
        userQueues.map(q => (
          <div className="ticket-row" key={q.queue_id}>
            <span className="name">{q.queue_id}</span>
            <span className="leader" />
            <span className={`badge ${q.status === 'waiting' ? 'pending' : q.status === 'serving' ? 'ready' : 'completed'}`}>{q.status}</span>
            <span className="desc">Party of {q.party_size}</span>
          </div>
        ))
      )}
    </div>
  );
}
