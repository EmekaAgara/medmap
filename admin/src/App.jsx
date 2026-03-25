import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './ThemeProvider';
import { AuthProvider, useAdminAuth } from './lib/auth';
import DashboardLayout from './layouts/DashboardLayout';
import LandingPage from './pages/Landing';
import LoginPage from './pages/Login';
import DashboardPage from './pages/Dashboard';
import UsersPage from './pages/Users';
import UserDetailPage from './pages/UserDetail';
import KycQueuePage from './pages/KycQueue';
import ActivityPage from './pages/Activity';
import ProvidersModerationPage from './pages/ProvidersModeration';
import AccountTypeRequestsPage from './pages/AccountTypeRequests';
import { PageSpinner } from './components/Spinner';

function ProtectedRoutes() {
  const { admin, loading } = useAdminAuth();
  if (loading) return <PageSpinner />;
  if (!admin) return <Navigate to="/login" replace />;
  return (
    <DashboardLayout>
      <Routes>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/users"     element={<UsersPage />} />
        <Route path="/users/:id" element={<UserDetailPage />} />
        <Route path="/account-type-requests" element={<AccountTypeRequestsPage />} />
        <Route path="/kyc"       element={<KycQueuePage />} />
        <Route path="/providers" element={<ProvidersModerationPage />} />
        <Route path="/activity"  element={<ActivityPage />} />
        <Route path="*"          element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </DashboardLayout>
  );
}

function LoginRoute() {
  const { admin, loading } = useAdminAuth();
  if (loading) return <PageSpinner />;
  if (admin) return <Navigate to="/dashboard" replace />;
  return <LoginPage />;
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/"      element={<LandingPage />} />
            <Route path="/login" element={<LoginRoute />} />
            <Route path="/*"     element={<ProtectedRoutes />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
