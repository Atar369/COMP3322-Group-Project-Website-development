import { useState, useMemo } from 'react';
import { menu_items } from '../data/mockData';

const categories = ['Starters', 'Mains', 'Desserts'];

export default function ViewMenu() {
  const [category, setCategory] = useState('All');

  const filtered = useMemo(
    () => menu_items.filter(i => category === 'All' || i.category === category),
    [category]
  );

  return (
    <div className="page">
      <h1>View Menu</h1>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {['All', ...categories].map(c => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={c === category ? 'btn' : 'btn secondary'}
            style={{ padding: '5px 12px', fontSize: '0.8rem' }}
          >
            {c}
          </button>
        ))}
      </div>

      {filtered.map(item => (
        <div className="ticket-row" key={item.item_id}>
          <span className="name">{item.name}</span>
          <span className="leader" />
          <span className="price">${item.price}</span>
          {item.is_available ? (
            <span style={{ fontSize: '0.8rem', color: 'var(--green)', fontWeight: 600 }}>Available</span>
          ) : (
            <span className="badge cancelled">Sold out</span>
          )}
          <span className="desc">{item.description}</span>
        </div>
      ))}
    </div>
  );
}
