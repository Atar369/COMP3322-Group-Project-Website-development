import { createContext, useContext, useState } from 'react';

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [items, setItems] = useState([]); // { item_id, name, price, qty }
  const [orderContext, setOrderContext] = useState(null); // { type: 'booking'|'queue', bookingId, queueId }

  function addItem(menuItem) {
    setItems(prev => {
      const existing = prev.find(i => i.item_id === menuItem.item_id);
      if (existing) {
        return prev.map(i => i.item_id === menuItem.item_id ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...prev, { item_id: menuItem.item_id, name: menuItem.name, price: menuItem.price, qty: 1 }];
    });
  }

  function removeItem(item_id) {
    setItems(prev => prev.filter(i => i.item_id !== item_id));
  }

  function clearCart() { setItems([]); setOrderContext(null); }

  const total = items.reduce((sum, i) => sum + i.price * i.qty, 0);

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, clearCart, total, orderContext, setOrderContext }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() { return useContext(CartContext); }
