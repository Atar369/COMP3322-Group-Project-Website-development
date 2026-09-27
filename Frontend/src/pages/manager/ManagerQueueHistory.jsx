import { useState, useMemo } from 'react';
import { queue_entries as initial, getGroupRange, restaurant_tables } from '../../data/mockData';

const ALL_GROUPS = ['all', 'A', 'B', 'C'];

function fmt(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function ManagerQueueHistory() {
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState('all');

  const seated = useMemo(() => {
    return initial
      .filter(q => q.status === 'seated')
      .filter(q => groupFilter === 'all' || q.group === groupFilter)
      .filter(q => search === '' || q.queue_id.toLowerCase().includes(search.trim().toLowerCase()))
      .sort((a, b) => new Date(b.seated_at) - new Date(a.seated_at));
  }, [search, groupFilter]);

  return (
    <div className="page">
      <h1>Queue History</h1>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          placeholder="Search by queue ID"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ padding: '8px 10px', border: '1px solid var(--line)', fontFamily: 'var(--font-body)', fontSize: '0.9rem', width: 180 }}
        />
        <div style={{ display: 'flex', gap: 6 }}>
          {ALL_GROUPS.map(g => (
            <button
              key={g}
              onClick={() => setGroupFilter(g)}
              className={groupFilter === g ? 'btn' : 'btn secondary'}
              style={{ padding: '5px 12px', fontSize: '0.8rem' }}
            >
              {g === 'all' ? 'All Groups' : `Group ${g} — ${getGroupRange(g)}`}
            </button>
          ))}
        </div>
      </div>

      {seated.length === 0 && (
        <p style={{ color: '#6b6558' }}>No seated records match your filter.</p>
      )}

      {seated.map(q => {
        const table = restaurant_tables.find(t => t.table_id === q.table_id);
        return (
          <div className="ticket-row" key={q.queue_id}>
            <span style={{ fontWeight: 700, fontFamily: 'var(--font-display)', fontSize: '1.1rem', minWidth: 60 }}>{q.queue_id}</span>
            <span className="name">Party of {q.party_size}</span>
            <span className="leader" />
            <span className="badge completed">seated</span>
            <span className="desc">
              Table: {table ? `#${table.table_number} (cap. ${table.capacity})` : '—'} &nbsp;|&nbsp;
              Joined: {fmt(q.joined_at)} &nbsp;|&nbsp;
              Called: {fmt(q.called_at)} &nbsp;|&nbsp;
              Seated: {fmt(q.seated_at)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
