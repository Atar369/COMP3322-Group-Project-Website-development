import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';

import Welcome from './pages/Welcome';
import CustomerLogin from './pages/CustomerLogin';
import StaffLogin from './pages/StaffLogin';
import CustomerRegister from './pages/CustomerRegister';
import StaffRegister from './pages/StaffRegister';
import CustomerDashboard from './pages/CustomerDashboard';
import Menu from './pages/Menu';
import ViewMenu from './pages/ViewMenu';
import Cart from './pages/Cart';
import OrderStatus from './pages/OrderStatus';
import OrderManagement from './pages/OrderManagement';
import OrderHistory from './pages/OrderHistory';
import Queue from './pages/Queue';
import QueueHistory from './pages/QueueHistory';
import Booking from './pages/Booking';
import BookingManagement from './pages/BookingManagement';
import BookingHistory from './pages/BookingHistory';
import ProfilePage from './pages/ProfilePage';

import ManagerMenu from './pages/manager/ManagerMenu';
import ManagerOrders from './pages/manager/ManagerOrders';
import ManagerQueue from './pages/manager/ManagerQueue';
import ManagerBookings from './pages/manager/ManagerBookings';
import ManagerDashboard from './pages/manager/ManagerDashboard';

function Home() {
  const { user } = useAuth();
  if (user?.role === 'manager') return <Navigate to="/manager/dashboard" replace />;
  if (user) return <Navigate to="/dashboard" replace />;
  return <Navigate to="/welcome" replace />;
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
              <Route path="/welcome" element={<Welcome />} />
              <Route path="/login" element={<Navigate to="/welcome" replace />} />
              <Route path="/login/customer" element={<CustomerLogin />} />
              <Route path="/login/staff" element={<StaffLogin />} />
              <Route path="/register/customer" element={<CustomerRegister />} />
              <Route path="/register/staff" element={<StaffRegister />} />

              <Route path="/dashboard" element={<ProtectedRoute role="customer"><CustomerDashboard /></ProtectedRoute>} />
              <Route path="/view-menu" element={<ProtectedRoute role="customer"><ViewMenu /></ProtectedRoute>} />
              <Route path="/menu" element={<ProtectedRoute role="customer"><Menu /></ProtectedRoute>} />
              <Route path="/cart" element={<ProtectedRoute role="customer"><Cart /></ProtectedRoute>} />
              <Route path="/orders/:id" element={<ProtectedRoute role="customer"><OrderStatus /></ProtectedRoute>} />
              <Route path="/order-management" element={<ProtectedRoute role="customer"><OrderManagement /></ProtectedRoute>} />
              <Route path="/order-history" element={<ProtectedRoute role="customer"><OrderHistory /></ProtectedRoute>} />
              <Route path="/queue" element={<ProtectedRoute role="customer"><Queue /></ProtectedRoute>} />
              <Route path="/queue-history" element={<ProtectedRoute role="customer"><QueueHistory /></ProtectedRoute>} />
              <Route path="/booking" element={<ProtectedRoute role="customer"><Booking /></ProtectedRoute>} />
              <Route path="/booking-management" element={<ProtectedRoute role="customer"><BookingManagement /></ProtectedRoute>} />
              <Route path="/booking-history" element={<ProtectedRoute role="customer"><BookingHistory /></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute role="customer"><ProfilePage /></ProtectedRoute>} />

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
