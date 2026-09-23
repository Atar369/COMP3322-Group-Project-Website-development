import { useState } from 'react';
import { menu_items } from '../../data/mockData';

export default function ManagerMenu() {
  const [items, setItems] = useState(menu_items);

  function toggleAvailable(item_id) {
    setItems(prev => prev.map(i => i.item_id === item_id ? { ...i, is_available: !i.is_available } : i));
  }

  function updatePrice(item_id, price) {
    setItems(prev => prev.map(i => i.item_id === item_id ? { ...i, price: Number(price) } : i));
  }

  return (
    <div className="page">
      <h1>Manage menu</h1>
      <p style={{ color: '#6b6558', fontSize: '0.9rem' }}>
        Each edit here would call PUT /api/menu/:id on the real backend.
      </p>
      {items.map(item => (
        <div className="ticket-row" key={item.item_id}>
          <span className="name">{item.name}</span>
          <span className="leader" />
          <input
            type="number"
            value={item.price}
            onChange={e => updatePrice(item.item_id, e.target.value)}
            style={{ width: 70, padding: '4px 6px', border: '1px solid var(--line)' }}
          />
          <button
            className={item.is_available ? 'btn secondary' : 'btn'}
            style={{ padding: '4px 10px', fontSize: '0.8rem' }}
            onClick={() => toggleAvailable(item.item_id)}
          >
            {item.is_available ? 'Mark sold out' : 'Mark available'}
          </button>
        </div>
      ))}
      <button className="btn" style={{ marginTop: 20 }}>+ Add new item</button>
    </div>
  );
}
