import { useState, useMemo } from 'react';
import { menu_items } from '../data/mockData';
import { useCart } from '../context/CartContext';

const categories = ['All', ...new Set(menu_items.map(i => i.category))];

export default function Menu() {
  const [category, setCategory] = useState('All');
  const { addItem, items } = useCart();

  const filtered = useMemo(
    () => menu_items.filter(i => category === 'All' || i.category === category),
    [category]
  );

  return (
    <div className="page">
      <h1>Tonight's menu</h1>
      <div className="nav-links" style={{ marginBottom: 20 }}>
        {categories.map(c => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={c === category ? 'btn' : 'btn secondary'}
            style={{ padding: '6px 14px', fontSize: '0.85rem' }}
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
            <button className="btn" style={{ padding: '4px 12px', fontSize: '0.85rem' }} onClick={() => addItem(item)}>
              Add
            </button>
          ) : (
            <span className="badge cancelled">Sold out</span>
          )}
          <span className="desc">{item.description}</span>
        </div>
      ))}

      {items.length > 0 && (
        <p style={{ marginTop: 24 }}>
          {items.reduce((n, i) => n + i.qty, 0)} item(s) in your cart —{' '}
          <a href="/cart" style={{ color: 'var(--green)', fontWeight: 600 }}>review order</a>
        </p>
      )}
    </div>
  );
}
