import { useState } from 'react';
import { menu_items } from '../../data/mockData';

const EMPTY_FORM = { name: '', description: '', category: 'Mains', price: '' };

export default function ManagerMenu() {
  const [items, setItems] = useState(menu_items);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');

  function toggleAvailable(item_id) {
    setItems(prev => prev.map(i => i.item_id === item_id ? { ...i, is_available: !i.is_available } : i));
  }

  function updatePrice(item_id, price) {
    setItems(prev => prev.map(i => i.item_id === item_id ? { ...i, price: Number(price) } : i));
  }

  function updateField(field, value) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  function handleAdd(e) {
    e.preventDefault();
    if (!form.name.trim()) { setError('Name is required.'); return; }
    if (!form.price || Number(form.price) <= 0) { setError('Enter a price greater than 0.'); return; }

    // Real backend: const res = await api.post('/menu', {...}); use res.data.item_id
    const newItem = {
      item_id: Math.max(0, ...items.map(i => i.item_id)) + 1,
      name: form.name.trim(),
      description: form.description.trim(),
      category: form.category,
      price: Number(form.price),
      is_available: true,
    };
    setItems(prev => [...prev, newItem]);
    setForm(EMPTY_FORM);
    setError('');
    setShowForm(false);
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

      {!showForm && (
        <button className="btn" style={{ marginTop: 20 }} onClick={() => setShowForm(true)}>
          + Add new item
        </button>
      )}

      {showForm && (
        <form className="card" style={{ marginTop: 20 }} onSubmit={handleAdd}>
          <h3>New menu item</h3>
          <div className="field">
            <label>Name</label>
            <input value={form.name} onChange={e => updateField('name', e.target.value)} />
          </div>
          <div className="field">
            <label>Description</label>
            <textarea rows={2} value={form.description} onChange={e => updateField('description', e.target.value)} />
          </div>
          <div className="field">
            <label>Category</label>
            <select value={form.category} onChange={e => updateField('category', e.target.value)}>
              <option>Starters</option>
              <option>Mains</option>
              <option>Desserts</option>
              <option>Drinks</option>
            </select>
          </div>
          <div className="field">
            <label>Price</label>
            <input type="number" min="0" value={form.price} onChange={e => updateField('price', e.target.value)} />
          </div>
          {error && <p className="error-text">{error}</p>}
          <button className="btn" type="submit">Save item</button>{' '}
          <button className="btn secondary" type="button" onClick={() => { setShowForm(false); setError(''); }}>
            Cancel
          </button>
        </form>
      )}
    </div>
  );
}