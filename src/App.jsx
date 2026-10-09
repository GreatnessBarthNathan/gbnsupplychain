import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import AppShell from './components/AppShell';
import AuthPage from './pages/AuthPage';
import Dashboard from './pages/Dashboard';
import Funnels from './pages/Funnels';
import Orders from './pages/Orders';
import Riders from './pages/Riders';
import PublicFunnel from './pages/PublicFunnel';
import TrackOrder from './pages/TrackOrder';
import RiderPortal from './pages/RiderPortal';

function Protected({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<AuthPage />} />
      <Route path="/invite/:token" element={<AuthPage invite />} />
      <Route path="/register" element={<Navigate to="/login" replace />} />
      <Route path="/f/:slug" element={<PublicFunnel />} />
      <Route path="/track/:orderNumber" element={<TrackOrder />} />
      <Route path="/rider/:accessToken" element={<RiderPortal />} />
      <Route path="/" element={<Protected><AppShell /></Protected>}>
        <Route index element={<Dashboard />} />
        <Route path="funnels" element={<Funnels />} />
        <Route path="orders" element={<Orders />} />
        <Route path="completed-orders" element={<Orders completed />} />
        <Route path="riders" element={<Riders />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
