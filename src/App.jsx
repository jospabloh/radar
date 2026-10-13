import { Toaster } from "@/components/ui/toaster"
import { ThemeProvider } from "next-themes"
import ThemeSwitcher from "@/components/ThemeSwitcher"
import UpdateBanner from "@/components/UpdateBanner"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { PermissionProvider } from '@/lib/PermissionContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import SessionHeartbeat from '@/lib/SessionHeartbeat';
import ProtectedRoute from '@/components/ProtectedRoute';
import Home from '@/pages/Home';
import Onboarding from '@/pages/Onboarding';
import SuperAdminCompanies from '@/pages/SuperAdminCompanies';
import CompanyDashboard from '@/pages/CompanyDashboard';
import Employees from '@/pages/Employees';
import Approvals from '@/pages/Approvals';
import Reports from '@/pages/Reports';
import EmployeePortal from '@/pages/EmployeePortal';
import AppLayout from '@/components/layout/AppLayout';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import CompanySettings from '@/pages/CompanySettings';
import SupportCenter from '@/pages/SupportCenter';
import LicenseManagement from '@/pages/LicenseManagement';
import UserManual from '@/pages/UserManual';
import ChangeLog from '@/pages/ChangeLog';
import EmployeeProfile from '@/pages/EmployeeProfile';
import AttendanceCalendar from '@/pages/AttendanceCalendar';
import NotificationSettings from '@/pages/NotificationSettings';
import MyRequests from '@/pages/MyRequests';
import ProductivityAnalytics from '@/pages/ProductivityAnalytics';
import ShiftSettings from '@/pages/ShiftSettings';
import IncidentPanel from '@/pages/IncidentPanel';
// Add page imports here

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Send the visitor to RADAR's own login, not Base44's.
      //
      // This used to call navigateToLogin() (base44.auth.redirectToLogin),
      // which navigates away to the platform-served login page. RADAR has its
      // own on-brand login at `/login` — the two-column AuthLayout the whole
      // portfolio shares — but this branch runs BEFORE <Routes> ever renders,
      // so the browser left the app before that route could match and the page
      // was never seen. Same bug jospabloh/puntos had (fixed 2026-08-23) and
      // jospabloh/ctrlhq before it; both CLAUDE.md files document it.
      //
      // ProtectedRoute below already bounces unauthenticated users to /login;
      // this makes the error path agree with it instead of leaving the app.
      return <Navigate to="/login" replace />;
    }
  }

  // Render the main app
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route path="/" element={<Home />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/portal" element={<EmployeePortal />} />
        <Route path="/perfil-empleado" element={<EmployeeProfile />} />
        <Route path="/mis-solicitudes" element={<MyRequests />} />
        <Route element={<AppLayout />}>
          <Route path="/companies" element={<SuperAdminCompanies />} />
          <Route path="/dashboard" element={<CompanyDashboard />} />
          <Route path="/employees" element={<Employees />} />
          <Route path="/approvals" element={<Approvals />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/configuracion-empresa" element={<CompanySettings />} />
          <Route path="/soporte" element={<SupportCenter />} />
          <Route path="/gestion-licencias" element={<LicenseManagement />} />
          <Route path="/manual-usuario" element={<UserManual />} />
          <Route path="/historial-cambios" element={<ChangeLog />} />
          <Route path="/calendario-asistencias" element={<AttendanceCalendar />} />
          <Route path="/configuracion-notificaciones" element={<NotificationSettings />} />
          <Route path="/analitica-productividad" element={<ProductivityAnalytics />} />
          <Route path="/configuracion-horarios" element={<ShiftSettings />} />
          <Route path="/panel-incidencias" element={<IncidentPanel />} />
        </Route>
      </Route>
      {/* Add your page Route elements here */}
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
      <AuthProvider>
        <PermissionProvider>
          <QueryClientProvider client={queryClientInstance}>
            <Router>
              <ScrollToTop />
              <SessionHeartbeat />
              <AuthenticatedApp />
            </Router>
            <Toaster />
            <ThemeSwitcher />
            <UpdateBanner />
          </QueryClientProvider>
        </PermissionProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App