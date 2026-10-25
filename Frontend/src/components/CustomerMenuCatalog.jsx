import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import api from '../services/api';
import useOrderWindow from '../hooks/useOrderWindow';
import OrderWindowNotice from './OrderWindowNotice';
import Pagination, { usePagination } from './Pagination';

const FOOD_TYPES = ['Starter', 'Main', 'Side', 'Dessert', 'Beverage'];

function getFoodType(category = '') {
  const normalized = category.trim().toLowerCase();
  if (normalized.includes('dessert') || normalized.includes('sweet')) return 'Dessert';
  if (normalized.includes('drink') || normalized.includes('beverage')) return 'Beverage';
  if (normalized.includes('starter') || normalized.includes('appetizer')) return 'Starter';
  if (normalized.includes('side')) return 'Side';
  return 'Main';
}

function isAvailable(item) {
  return item.is_available === true || item.is_available === 1;
}

function MenuCard({ item, canOrder, managerMode, onAdd, onUpdatePrice, onToggleAvailability, onRemove, orderWindow }) {
  const [editingPrice, setEditingPrice] = useState(false);
  const [priceDraft, setPriceDraft] = useState(Number(item.price).toFixed(2));
  const [confirmRemove, setConfirmRemove] = useState(false);
  const available = isAvailable(item);
  const canAdd = canOrder && available && !(orderWindow.hasOrderContext && !orderWindow.canOrder);

  async function savePrice(event) {
    event.preventDefault();
    const value = Number(priceDraft);
    if (!Number.isFinite(value) || value <= 0 || !/^\d+(\.\d{1,2})?$/.test(priceDraft)) return;
    const saved = await onUpdatePrice(item.item_id, value);
    if (saved) setEditingPrice(false);
  }

  return (
    <article className="menu-food-card">
      <div className="menu-food-photo">
        <div className="menu-food-photo-placeholder" aria-hidden="true">
          <span>{getFoodType(item.category)}</span>
          <small>Food photo</small>
        </div>
        {item.image_url && (
          <img
            src={item.image_url}
            alt={item.name}
            onError={event => { event.currentTarget.style.display = 'none'; }}
          />
        )}
        {managerMode ? (
          <button
            type="button"
            className={`menu-food-status menu-food-availability${available ? ' is-available' : ' is-sold-out'}`}
            onClick={() => onToggleAvailability(item)}
          >
            {available ? 'Mark sold out' : 'Put on sale'}
          </button>
        ) : (
          <span className={`menu-food-status${available ? ' is-available' : ' is-sold-out'}`}>
            {available ? 'On sale' : 'Sold out'}
          </span>
        )}
      </div>
      <div className="menu-food-content">
        <div className="menu-food-heading">
          <h2>{item.name}</h2>
          <span className="menu-food-type">{getFoodType(item.category)}</span>
        </div>
        <p className="menu-food-description">{item.description || 'A thoughtfully prepared Ember & Oak favorite.'}</p>
        <div className="menu-food-footer">
          {editingPrice ? (
            <form className="menu-price-editor" onSubmit={savePrice}>
              <label className="visually-hidden" htmlFor={`menu-price-${item.item_id}`}>Price in HKD</label>
              <span>$</span>
              <input
                id={`menu-price-${item.item_id}`}
                type="number"
                min="0.01"
                step="0.01"
                value={priceDraft}
                onChange={event => setPriceDraft(event.target.value)}
                autoFocus
              />
              <button type="submit" className="menu-price-save">Save</button>
              <button type="button" className="menu-price-cancel" onClick={() => {
                setPriceDraft(Number(item.price).toFixed(2));
                setEditingPrice(false);
              }}>Cancel</button>
            </form>
          ) : managerMode ? (
            <button
              type="button"
              className="menu-food-price menu-food-price-edit"
              onClick={() => {
                setPriceDraft(Number(item.price).toFixed(2));
                setEditingPrice(true);
              }}
              aria-label={`Edit price for ${item.name}`}
              title="Click to edit price"
            >
              ${Number(item.price).toFixed(2)} <span aria-hidden="true">✎</span>
            </button>
          ) : (
            <span className="menu-food-price">${Number(item.price).toFixed(2)}</span>
          )}
          {canOrder && (
            <button
              type="button"
              className="menu-food-add"
              onClick={() => onAdd(item)}
              disabled={!canAdd}
              aria-label={`Add ${item.name} to cart`}
              title={!available ? 'Sold out' : !canAdd ? 'Ordering is currently closed.' : `Add ${item.name} to cart`}
            >
              <span aria-hidden="true">+</span>
            </button>
          )}
          {managerMode && (
            <div className="menu-food-remove-control">
              {confirmRemove ? (
                <>
                  <span>Remove this dish?</span>
                  <button type="button" className="menu-remove-confirm" onClick={() => onRemove(item)}>Confirm</button>
                  <button type="button" className="menu-remove-cancel" onClick={() => setConfirmRemove(false)}>Cancel</button>
                </>
              ) : (
                <button type="button" className="menu-remove-button" onClick={() => setConfirmRemove(true)}>Remove</button>
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

export default function CustomerMenuCatalog({ canOrder = false, managerMode = false }) {
  const { user } = useAuth();
  const { addItem, items, orderContext } = useCart();
  const orderWindow = useOrderWindow(user, orderContext, canOrder);
  const [menuItems, setMenuItems] = useState([]);
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [minimumPrice, setMinimumPrice] = useState('');
  const [maximumPrice, setMaximumPrice] = useState('');
  const [error, setError] = useState('');
  const [menuFormOpen, setMenuFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newItem, setNewItem] = useState({ name: '', description: '', category: 'Main', price: '', image: null });

  useEffect(() => {
    let active = true;
    api.get('/booking/menu')
      .then(response => {
        if (active) setMenuItems(Array.isArray(response.data) ? response.data : []);
      })
      .catch(() => {
        if (active) setError('Could not load the menu. Please refresh the page and try again.');
      });
    return () => { active = false; };
  }, []);

  const prices = useMemo(
    () => menuItems.map(item => Number(item.price)).filter(Number.isFinite),
    [menuItems]
  );
  const availablePriceRange = useMemo(() => ({
    minimum: prices.length ? Math.min(...prices) : 0,
    maximum: prices.length ? Math.max(...prices) : 0,
  }), [prices]);
  const cartCount = items.reduce((count, item) => count + item.qty, 0);
  const invalidRange = minimumPrice !== '' && maximumPrice !== ''
    && Number(minimumPrice) > Number(maximumPrice);

  const filteredItems = useMemo(() => menuItems.filter(item => {
    const type = getFoodType(item.category);
    const price = Number(item.price);
    const matchesType = selectedTypes.length === 0 || selectedTypes.includes(type);
    const matchesMinimum = minimumPrice === '' || price >= Number(minimumPrice);
    const matchesMaximum = maximumPrice === '' || price <= Number(maximumPrice);
    return matchesType && matchesMinimum && matchesMaximum;
  }), [menuItems, selectedTypes, minimumPrice, maximumPrice]);
  const pagination = usePagination(filteredItems, `${selectedTypes.join(',')}|${minimumPrice}|${maximumPrice}`);

  function toggleFoodType(type) {
    setSelectedTypes(current => current.includes(type)
      ? current.filter(selected => selected !== type)
      : [...current, type]);
  }

  function clearFilters() {
    setSelectedTypes([]);
    setMinimumPrice('');
    setMaximumPrice('');
  }

  function updateNewItem(field, value) {
    setNewItem(current => ({ ...current, [field]: value }));
  }

  async function updateAvailability(item) {
    setError('');
    try {
      const response = await api.patch(`/menu/${item.item_id}`, { is_available: !isAvailable(item) });
      setMenuItems(current => current.map(existing => existing.item_id === item.item_id ? response.data.item : existing));
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Could not update availability.');
    }
  }

  async function updatePrice(itemId, price) {
    setError('');
    try {
      const response = await api.patch(`/menu/${itemId}`, { price });
      setMenuItems(current => current.map(existing => existing.item_id === itemId ? response.data.item : existing));
      return true;
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Could not update the price.');
      return false;
    }
  }

  async function removeItem(item) {
    setError('');
    try {
      await api.delete(`/menu/${item.item_id}`);
      setMenuItems(current => current.filter(existing => existing.item_id !== item.item_id));
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Could not remove the menu item.');
    }
  }

  async function createItem(event) {
    event.preventDefault();
    setError('');
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('name', newItem.name);
      formData.append('description', newItem.description);
      formData.append('category', newItem.category);
      formData.append('price', newItem.price);
      formData.append('image', newItem.image);
      const response = await api.post('/menu', formData);
      setMenuItems(current => [...current, response.data.item]);
      setNewItem({ name: '', description: '', category: 'Main', price: '', image: null });
      setMenuFormOpen(false);
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Could not add the menu item.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="customer-menu-page">
      <header className="customer-menu-heading">
        <div>
          <span className="section-label">{managerMode ? 'MENU MANAGEMENT' : 'EMBER & OAK'}</span>
          <h1>{managerMode ? 'Manage Menu' : canOrder ? 'Order from Our Menu' : 'Explore Our Menu'}</h1>
          <p>{managerMode ? 'Edit dish details, prices, availability, and photos.' : canOrder ? 'Choose something made for the table.' : 'Thoughtfully sourced. Artfully composed.'}</p>
        </div>
        {managerMode && (
          <button type="button" className="btn" onClick={() => setMenuFormOpen(open => !open)}>
            {menuFormOpen ? 'Cancel adding item' : '+ Add new item'}
          </button>
        )}
        {canOrder && cartCount > 0 && (
          <Link className="menu-cart-link" to="/cart">View Cart <span>{cartCount}</span></Link>
        )}
      </header>

      {canOrder && <OrderWindowNotice orderWindow={orderWindow} />}

      {error && <p className="error-text" role="alert">{error}</p>}

      {managerMode && menuFormOpen && (
        <form className="menu-new-item-form" onSubmit={createItem}>
          <h2>Add a menu item</h2>
          <div className="menu-new-item-fields">
            <label>
              Dish name
              <input required maxLength="120" value={newItem.name} onChange={event => updateNewItem('name', event.target.value)} />
            </label>
            <label>
              Category
              <select value={newItem.category} onChange={event => updateNewItem('category', event.target.value)}>
                {FOOD_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
              </select>
            </label>
            <label>
              Price (HKD)
              <input required type="number" min="0.01" step="0.01" value={newItem.price} onChange={event => updateNewItem('price', event.target.value)} />
            </label>
            <label>
              Food photo (PNG, up to 5 MB)
              <input
                required
                type="file"
                accept="image/png,.png"
                onChange={event => updateNewItem('image', event.target.files?.[0] || null)}
              />
            </label>
            <label className="menu-new-item-description">
              Description
              <textarea required maxLength="5000" rows="3" value={newItem.description} onChange={event => updateNewItem('description', event.target.value)} />
            </label>
          </div>
          {newItem.image && <p className="menu-selected-image">Selected: {newItem.image.name}</p>}
          <div className="menu-new-item-actions">
            <button className="btn" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save item'}</button>
            <button className="btn secondary" type="button" disabled={saving} onClick={() => {
              setMenuFormOpen(false);
              setNewItem({ name: '', description: '', category: 'Main', price: '', image: null });
              setError('');
            }}>Cancel</button>
          </div>
        </form>
      )}

      <div className="customer-menu-layout">
        <aside className="menu-filter-panel" aria-label="Menu filters">
          <div className="menu-filter-heading">
            <h2>Refine the menu</h2>
            <button type="button" onClick={clearFilters}>Clear all</button>
          </div>

          <fieldset className="menu-filter-group">
            <legend>Food type</legend>
            {FOOD_TYPES.map(type => (
              <label className="menu-filter-option" key={type}>
                <span>{type}</span>
                <input
                  type="checkbox"
                  checked={selectedTypes.includes(type)}
                  onChange={() => toggleFoodType(type)}
                />
              </label>
            ))}
          </fieldset>

          <fieldset className="menu-filter-group menu-price-filter">
            <legend>Price range</legend>
            <p>Menu prices in HKD</p>
            <div className="menu-price-inputs">
              <label>
                <span>Min</span>
                <input
                  type="number"
                  min="0"
                  placeholder={String(availablePriceRange.minimum)}
                  value={minimumPrice}
                  onChange={event => setMinimumPrice(event.target.value)}
                  aria-label="Minimum price"
                />
              </label>
              <span className="menu-price-separator">—</span>
              <label>
                <span>Max</span>
                <input
                  type="number"
                  min="0"
                  placeholder={String(availablePriceRange.maximum)}
                  value={maximumPrice}
                  onChange={event => setMaximumPrice(event.target.value)}
                  aria-label="Maximum price"
                />
              </label>
            </div>
            {invalidRange && <p className="menu-filter-error">Minimum price must be lower than maximum.</p>}
          </fieldset>
        </aside>

        <section className="menu-food-results" aria-label="Food items" data-pagination-anchor>
          <div className="menu-results-heading">
            <h2>Menu</h2>
            <span>{filteredItems.length} {filteredItems.length === 1 ? 'item' : 'items'}</span>
          </div>
          {!error && filteredItems.length === 0 ? (
            <p className="menu-empty-state">No dishes match these filters.</p>
          ) : (
            <div className="menu-food-grid">
              {pagination.pageItems.map(item => (
                <MenuCard
                  key={item.item_id}
                  item={item}
                  canOrder={canOrder}
                  managerMode={managerMode}
                  onAdd={addItem}
                  onUpdatePrice={updatePrice}
                  onToggleAvailability={updateAvailability}
                  onRemove={removeItem}
                  orderWindow={orderWindow}
                />
              ))}
            </div>
          )}
          <Pagination
            page={pagination.page}
            pageCount={pagination.pageCount}
            totalItems={filteredItems.length}
            onPageChange={pagination.setPage}
          />
        </section>
      </div>
    </main>
  );
}
