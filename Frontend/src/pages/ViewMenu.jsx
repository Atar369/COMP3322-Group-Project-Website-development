import { useState, useMemo, useEffect } from 'react';

export default function ViewMenu() {
  const [category, setCategory] = useState('All');
  const [menuItems, setMenuItems] = useState([]);

  useEffect(() => {
    fetch('/api/booking/menu')
      .then(r => r.json())
      .then(d => setMenuItems(Array.isArray(d) ? d : []))
      .catch(() => setMenuItems([]));
  }, []);

  const categories = useMemo(() => {
    const cats = [...new Set(menuItems.map(i => i.category))];
    return ['All', ...cats];
  }, [menuItems]);

  const filtered = useMemo(
    () => menuItems.filter(i => category === 'All' || i.category === category),
    [menuItems, category]
  );

  return (
    <div className="page">
      <h1>View Menu</h1>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {categories.map(c => (
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
          <span className="price">${Number(item.price).toFixed(0)}</span>
          {(item.is_available || item.is_available === 1) ? (
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
