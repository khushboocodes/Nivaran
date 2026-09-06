import { BrowserRouter, Routes, Route, Outlet } from 'react-router-dom';
import { ComplaintProvider } from './contexts/ComplaintContext';
import { DepartmentScopeProvider } from './contexts/DepartmentScopeContext';
import { AuthProvider } from './auth/AuthProvider';
import { RequireAuth, RequireRole, RedirectIfAuthenticated } from './auth/guards';
import ErrorBoundary from './components/ErrorBoundary';
import TelemetryBanner from './components/TelemetryBanner';

// Landing Page
import LandingPage from './pages/LandingPage';
import NotFound from './pages/NotFound';

// Authentication Pages
import CitizenLogin from './pages/auth/CitizenLogin';
import CitizenSignup from './pages/auth/CitizenSignup';
import AdminLogin from './pages/auth/AdminLogin';

// Citizen Portal Pages
import CitizenDashboard from './pages/citizen/Dashboard';
import SubmitComplaint from './pages/citizen/SubmitComplaint';
import TrackComplaint from './pages/citizen/TrackComplaint';
import MyComplaints from './pages/citizen/MyComplaints';
import Notifications from './pages/citizen/Notifications';
import AIAssistant from './pages/citizen/AIAssistant';
import CitizenProfile from './pages/citizen/Profile';

// Admin Console Pages
import AdminDashboard from './pages/admin/Dashboard';
import AdminComplaints from './pages/admin/Complaints';
import AdminAnalytics from './pages/admin/Analytics';
import AdminHeatmap from './pages/admin/Heatmap';
import AdminEscalation from './pages/admin/Escalation';
import AdminReports from './pages/admin/Reports';
import AdminPlanning from './pages/admin/Planning';
import AdminFeedback from './pages/admin/Feedback';
import AdminSettings from './pages/admin/Settings';
import AdminAudit from './pages/admin/Audit';
import AdminUsers from './pages/admin/Users';

/**
 * Supplies the admin department scope to every admin page.
 *
 * Mounted as a pathless layout route so the provider is an ancestor of the
 * pages rather than a descendant. Scoped to /admin/* rather than the whole
 * app because the provider fetches the department list, which is meaningless
 * for citizens and would be a wasted request on every citizen page.
 */
function AdminScope() {
  return (
    <DepartmentScopeProvider>
      <Outlet />
    </DepartmentScopeProvider>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <ComplaintProvider>
            <Routes>
        {/* Landing Page — public-only. A signed-in user is sent straight
            to their own dashboard so the Back button can never land them
            on the marketing page mid-session. */}
        <Route path="/" element={<RedirectIfAuthenticated><LandingPage /></RedirectIfAuthenticated>} />

        {/* Authentication — public-only. An already-signed-in user is
            sent to the dashboard for their role so the Back button can
            never land them on a login form post-auth. */}
        <Route path="/login" element={<RedirectIfAuthenticated><CitizenLogin /></RedirectIfAuthenticated>} />
        <Route path="/signup" element={<RedirectIfAuthenticated><CitizenSignup /></RedirectIfAuthenticated>} />
        <Route path="/admin/login" element={<RedirectIfAuthenticated><AdminLogin /></RedirectIfAuthenticated>} />

        {/* Citizen Portal — citizens only. An admin who tries to enter
            a /citizen/* path is redirected to /admin/dashboard. */}
        <Route path="/citizen/dashboard" element={<RequireAuth roles={['citizen']} redirectTo="/login"><CitizenDashboard /></RequireAuth>} />
        <Route path="/citizen/submit" element={<RequireAuth roles={['citizen']} redirectTo="/login"><SubmitComplaint /></RequireAuth>} />
        <Route path="/citizen/track" element={<RequireAuth roles={['citizen']} redirectTo="/login"><TrackComplaint /></RequireAuth>} />
        <Route path="/citizen/complaints" element={<RequireAuth roles={['citizen']} redirectTo="/login"><MyComplaints /></RequireAuth>} />
        <Route path="/citizen/notifications" element={<RequireAuth roles={['citizen']} redirectTo="/login"><Notifications /></RequireAuth>} />
        <Route path="/citizen/assistant" element={<RequireAuth roles={['citizen']} redirectTo="/login"><AIAssistant /></RequireAuth>} />
        <Route path="/citizen/profile" element={<RequireAuth roles={['citizen']} redirectTo="/login"><CitizenProfile /></RequireAuth>} />

        {/* Admin Console.
            Wrapped in a pathless layout route so DepartmentScopeProvider sits
            ABOVE every admin page. It used to live inside AdminLayout, which
            each page renders as a *child* — so a page's own
            `useDepartmentScope()` call ran higher in the tree than the
            provider and silently received the "all departments" fallback.
            The sidebar selector, being inside AdminLayout, read the real
            value, which is why the label changed while none of the data did. */}
        <Route element={<AdminScope />}>
        <Route path="/admin/dashboard" element={<RequireRole roles={['admin', 'officer']} redirectTo="/admin/login"><AdminDashboard /></RequireRole>} />
        <Route path="/admin/complaints" element={<RequireRole roles={['admin', 'officer']} redirectTo="/admin/login"><AdminComplaints /></RequireRole>} />
        <Route path="/admin/analytics" element={<RequireRole roles={['admin', 'officer']} redirectTo="/admin/login"><AdminAnalytics /></RequireRole>} />
        <Route path="/admin/heatmap" element={<RequireRole roles={['admin', 'officer']} redirectTo="/admin/login"><AdminHeatmap /></RequireRole>} />
        <Route path="/admin/escalation" element={<RequireRole roles={['admin', 'officer']} redirectTo="/admin/login"><AdminEscalation /></RequireRole>} />
        <Route path="/admin/reports" element={<RequireRole roles={['admin', 'officer']} redirectTo="/admin/login"><AdminReports /></RequireRole>} />
        <Route path="/admin/planning" element={<RequireRole roles={['admin', 'officer']} redirectTo="/admin/login"><AdminPlanning /></RequireRole>} />
        <Route path="/admin/feedback" element={<RequireRole roles={['admin', 'officer']} redirectTo="/admin/login"><AdminFeedback /></RequireRole>} />
        <Route path="/admin/settings" element={<RequireRole roles={['admin', 'officer']} redirectTo="/admin/login"><AdminSettings /></RequireRole>} />
        <Route path="/admin/audit" element={<RequireRole roles={['admin', 'officer']} redirectTo="/admin/login"><AdminAudit /></RequireRole>} />
        <Route path="/admin/users" element={<RequireRole roles={['admin']} redirectTo="/admin/login"><AdminUsers /></RequireRole>} />
        </Route>

        {/* Catch-all 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>
            <TelemetryBanner />
          </ComplaintProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
