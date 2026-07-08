import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, FileText, BarChart3, Map, AlertTriangle, FileBarChart, Star, Settings, LogOut, ChevronDown, Users, Menu, X } from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';
import {
  DepartmentScopeProvider,
  useDepartmentScope,
} from '../../contexts/DepartmentScopeContext';
import { useMobileNav } from './useMobileNav';

interface AdminLayoutProps {
  children: React.ReactNode;
}

function DepartmentSelector() {
  const { scope, setScope, departments, scopeLabel } = useDepartmentScope();
  return (
    <div className="relative">
      <div className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-[#2F5BFF] hover:bg-[#2549D9] transition-all shadow-sm pointer-events-none">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-5 h-5 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
            <LayoutDashboard className="w-3.5 h-3.5" strokeWidth={2} />
          </div>
          <span className="text-xs font-medium truncate">{scopeLabel}</span>
        </div>
        <ChevronDown className="w-3.5 h-3.5 shrink-0" strokeWidth={2} />
      </div>
      <select
        value={scope}
        onChange={(e) => setScope(e.target.value)}
        aria-label="Filter by department"
        className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
      >
        <option value="all">All Departments</option>
        {departments.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <DepartmentScopeProvider>
      <AdminLayoutInner>{children}</AdminLayoutInner>
    </DepartmentScopeProvider>
  );
}

function AdminLayoutInner({ children }: AdminLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { open, openMenu, closeMenu } = useMobileNav();

  const handleSignOut = async () => {
    try {
      await logout();
    } finally {
      // `replace: true` so the protected page we're leaving is dropped from
      // history. Pressing Back from the landing page after logout takes the
      // user further back, never to the protected route.
      navigate('/', { replace: true });
    }
  };

  const coreNav = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/admin/dashboard' },
    { icon: FileText, label: 'Complaints', path: '/admin/complaints' },
    { icon: BarChart3, label: 'AI Analytics', path: '/admin/analytics' },
    { icon: Map, label: 'Heatmaps', path: '/admin/heatmap' },
    { icon: AlertTriangle, label: 'Escalation', path: '/admin/escalation' },
  ];

  // The Users page is admin-only on both the route guard and the API,
  // so we hide its sidebar entry from officers to keep their nav clean.
  // Admins still see it (and it's the only way to invite new staff).
  const insightsNav = [
    { icon: FileBarChart, label: 'Reports', path: '/admin/reports' },
    { icon: Star, label: 'Feedback', path: '/admin/feedback' },
    ...(user?.role === 'admin'
      ? [{ icon: Users, label: 'Users', path: '/admin/users' }]
      : []),
    { icon: Settings, label: 'Settings', path: '/admin/settings' },
  ];

  /**
   * Sidebar markup shared between the desktop column and the mobile
   * off-canvas drawer. Both render the exact same content; only the
   * outer wrapper differs.
   */
  const sidebarBody = (
    <>
      {/* Logo */}
      <div className="px-5 py-5 border-b border-white/10 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5" onClick={closeMenu}>
          <div className="w-9 h-9 rounded-xl bg-[#2F5BFF] flex items-center justify-center shadow-lg">
            <span className="text-white font-bold text-base">N</span>
          </div>
          <div>
            <div className="font-bold text-sm tracking-tight">NIVARAN</div>
            <div className="text-[10px] text-white/40 uppercase tracking-wider font-medium">Admin Console</div>
          </div>
        </Link>
        {/* Drawer-only close button. */}
        <button
          type="button"
          onClick={closeMenu}
          aria-label="Close menu"
          className="lg:hidden w-9 h-9 rounded-lg text-white/70 hover:bg-white/10 flex items-center justify-center"
        >
          <X className="w-5 h-5" strokeWidth={2} />
        </button>
      </div>

      {/* Department Selector */}
      <div className="px-4 py-4">
        <DepartmentSelector />
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 pt-1 space-y-6 overflow-y-auto">
        {/* Core Section */}
        <div>
          <div className="text-[10px] text-white/35 uppercase tracking-wider mb-2.5 px-3 font-semibold">Core</div>
          <ul className="space-y-1">
            {coreNav.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;

              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    onClick={closeMenu}
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all ${
                      isActive
                        ? 'bg-[#2F5BFF] text-white shadow-md'
                        : 'text-white/55 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <Icon className="w-[18px] h-[18px]" strokeWidth={2} />
                    <span className="text-[13px] font-medium">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Insights Section */}
        <div>
          <div className="text-[10px] text-white/35 uppercase tracking-wider mb-2.5 px-3 font-semibold">Insights</div>
          <ul className="space-y-1">
            {insightsNav.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;

              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    onClick={closeMenu}
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all ${
                      isActive
                        ? 'bg-[#2F5BFF] text-white shadow-md'
                        : 'text-white/55 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <Icon className="w-[18px] h-[18px]" strokeWidth={2} />
                    <span className="text-[13px] font-medium">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>

      {/* Sign Out */}
      <div className="p-3 border-t border-white/10">
        <button
          type="button"
          onClick={handleSignOut}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-white/55 hover:text-[#EF4444] hover:bg-[#FEE2E2]/10 transition-all"
        >
          <LogOut className="w-[18px] h-[18px]" strokeWidth={2} />
          <span className="text-[13px] font-medium">Sign Out</span>
        </button>
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-[#F4F7FB]">
      {/* Desktop sidebar — visible at lg and above. */}
      <aside className="hidden lg:flex w-64 bg-[#0F1F63] text-white flex-col">
        {sidebarBody}
      </aside>

      {/* Mobile drawer + backdrop. */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
            onClick={closeMenu}
            aria-hidden="true"
          />
          <aside
            className="relative w-72 max-w-[85vw] bg-[#0F1F63] text-white flex flex-col shadow-2xl animate-in slide-in-from-left duration-200"
            role="dialog"
            aria-label="Admin menu"
          >
            {sidebarBody}
          </aside>
        </div>
      )}

      {/* Main column with mobile top bar. */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 bg-[#0F1F63] text-white shadow-md">
          <button
            type="button"
            onClick={openMenu}
            aria-label="Open menu"
            className="w-10 h-10 rounded-lg text-white hover:bg-white/10 flex items-center justify-center"
          >
            <Menu className="w-5 h-5" strokeWidth={2} />
          </button>
          <Link to="/admin/dashboard" className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-[#2F5BFF] flex items-center justify-center shadow-sm shrink-0">
              <span className="text-white font-bold text-sm">N</span>
            </div>
            <span className="font-bold text-sm tracking-tight">NIVARAN</span>
          </Link>
        </header>

        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
