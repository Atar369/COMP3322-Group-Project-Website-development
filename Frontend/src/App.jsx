import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';

import Login from './pages/Login';
import Register from './pages/Register';
import Menu from './pages/Menu';
import Cart from './pages/Cart';
import OrderStatus from './pages/OrderStatus';
import Queue from './pages/Queue';
import Booking from './pages/Booking';

import ManagerMenu from './pages/manager/ManagerMenu';
import ManagerOrders from './pages/manager/ManagerOrders';
import ManagerQueue from './pages/manager/ManagerQueue';
import ManagerBookings from './pages/manager/ManagerBookings';
import ManagerDashboard from './pages/manager/ManagerDashboard';

function Home() {
  const { user } = useAuth();
  if (user?.role === 'manager') return <Navigate to="/manager/dashboard" replace />;
  if (user) return <Navigate to="/menu" replace />;
  return <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <BrowserRouter>
          <div className="app-shell">
            <Navbar />
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />

              <Route path="/menu" element={<ProtectedRoute role="customer"><Menu /></ProtectedRoute>} />
              <Route path="/cart" element={<ProtectedRoute role="customer"><Cart /></ProtectedRoute>} />
              <Route path="/orders/:id" element={<ProtectedRoute role="customer"><OrderStatus /></ProtectedRoute>} />
              <Route path="/queue" element={<ProtectedRoute role="customer"><Queue /></ProtectedRoute>} />
              <Route path="/booking" element={<ProtectedRoute role="customer"><Booking /></ProtectedRoute>} />

              <Route path="/manager/menu" element={<ProtectedRoute role="manager"><ManagerMenu /></ProtectedRoute>} />
              <Route path="/manager/orders" element={<ProtectedRoute role="manager"><ManagerOrders /></ProtectedRoute>} />
              <Route path="/manager/queue" element={<ProtectedRoute role="manager"><ManagerQueue /></ProtectedRoute>} />
              <Route path="/manager/bookings" element={<ProtectedRoute role="manager"><ManagerBookings /></ProtectedRoute>} />
              <Route path="/manager/dashboard" element={<ProtectedRoute role="manager"><ManagerDashboard /></ProtectedRoute>} />
            </Routes>
          </div>
        </BrowserRouter>
      </CartProvider>
    </AuthProvider>
  );
}
