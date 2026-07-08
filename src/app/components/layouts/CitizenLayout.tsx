import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Plus, Search, FileText, Bell, Bot, LogOut, Menu, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../auth/AuthProvider';
import { useComplaints } from '../../contexts/ComplaintContext';
import LanguageSwitcher from '../LanguageSwitcher';
import { useMobileNav } from './useMobileNav';

interface CitizenLayoutProps {
  children: React.ReactNode;
}

export default function CitizenLayout({ children }: CitizenLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { t } = useTranslation(['citizen', 'common']);
  const { notifications } = useComplaints();
  const unreadCount = notifications.filter((n) => !n.read).length;
  const { open, openMenu, closeMenu } = useMobileNav();

  const handleSignOut = async () => {
    try {
      await logout();
    } finally {
      // `replace: true` so the protected page we're leaving is dropped
      // from history; Back can't return to it.
      navigate('/', { replace: true });
    }
  };

  const navItems = [
    { icon: LayoutDashboard, label: t('citizen:nav.dashboard'), path: '/citizen/dashboard' },
    { icon: Plus, label: t('citizen:nav.submit'), path: '/citizen/submit' },
    { icon: Search, label: t('citizen:nav.track'), path: '/citizen/track' },
    { icon: FileText, label: t('citizen:nav.complaints'), path: '/citizen/complaints' },
    { icon: Bell, label: t('citizen:nav.notifications'), path: '/citizen/notifications' },
    { icon: Bot, label: t('citizen:nav.assistant'), path: '/citizen/assistant' },
  ];

  /**
   * The sidebar markup is shared between the desktop column and the
   * off-canvas mobile drawer. Pulling it into a constant keeps the JSX
   * tidy and guarantees the two render the exact same content. Only the
   * outer wrapper differs (column on desktop, slide-in panel on mobile).
   */
  const sidebarBody = (
    <>
      {/* Logo */}
      <div className="p-6 border-b border-[#E5E7EB] flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5" onClick={closeMenu}>
          <div className="w-9 h-9 rounded-xl bg-[#2952E3] flex items-center justify-center shadow-sm">
            <span className="text-white font-bold text-base">N</span>
          </div>
          <div>
            <div className="font-bold text-[#0B1220] text-base">NIVARAN</div>
            <div className="text-[10px] text-[#6B7280] uppercase tracking-wider font-medium">{t('citizen:portalEyebrow')}</div>
          </div>
        </Link>
        {/* Drawer-only close button. `lg:hidden` keeps it invisible on desktop. */}
        <button
          type="button"
          onClick={closeMenu}
          aria-label="Close menu"
          className="lg:hidden w-9 h-9 rounded-lg text-[#6B7280] hover:bg-[#F8FAFC] flex items-center justify-center"
        >
          <X className="w-5 h-5" strokeWidth={2} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 pt-6 overflow-y-auto">
        <ul className="space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            const isNotifications = item.path === '/citizen/notifications';

            return (
              <li key={item.path}>
                <Link
                  to={item.path}
                  onClick={closeMenu}
                  className={`group relative flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all duration-200 ${
                    isActive
                      ? 'bg-[#EEF2FF] text-[#2952E3]'
                      : 'text-[#6B7280] hover:bg-[#F8FAFC] hover:text-[#0B1220]'
                  }`}
                >
                  {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-[#2952E3] rounded-r-full" />
                  )}
                  <Icon className={`w-5 h-5 transition-colors ${isActive ? 'text-[#2952E3]' : 'text-[#6B7280] group-hover:text-[#0B1220]'}`} strokeWidth={2} />
                  <span className={`text-sm font-medium transition-colors ${isActive ? 'text-[#2952E3]' : 'text-[#6B7280] group-hover:text-[#0B1220]'}`}>
                    {item.label}
                  </span>
                  {isNotifications && unreadCount > 0 && (
                    <span className="ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-[#EF4444] text-white text-[10px] font-semibold">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Language */}
      <div className="px-4 pt-4">
        <LanguageSwitcher variant="sidebar" />
      </div>

      {/* Sign Out */}
      <div className="p-4 border-t border-[#E5E7EB]">
        <button
          type="button"
          onClick={handleSignOut}
          className="group w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[#6B7280] hover:bg-[#FEE2E2] hover:text-[#EF4444] transition-all duration-200"
        >
          <LogOut className="w-5 h-5 group-hover:text-[#EF4444] transition-colors" strokeWidth={2} />
          <span className="text-sm font-medium group-hover:text-[#EF4444] transition-colors">{t('common:signOut')}</span>
        </button>
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-[#F8FAFC]">
      {/* Desktop sidebar — visible at lg and above. Identical to the
          previous markup so the desktop layout is pixel-identical. */}
      <aside className="hidden lg:flex w-64 bg-white border-r border-[#E5E7EB] flex-col shadow-sm">
        {sidebarBody}
      </aside>

      {/* Mobile drawer + backdrop — only rendered when open.
          `fixed inset-0` puts it above the page; `lg:hidden` ensures it
          never appears on desktop even if the state is somehow open. */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
            onClick={closeMenu}
            aria-hidden="true"
          />
          <aside
            className="relative w-72 max-w-[85vw] bg-white border-r border-[#E5E7EB] flex flex-col shadow-xl animate-in slide-in-from-left duration-200"
            role="dialog"
            aria-label="Main menu"
          >
            {sidebarBody}
          </aside>
        </div>
      )}

      {/* Main column — has its own top bar on mobile, none on desktop. */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar with hamburger. `lg:hidden` hides it on desktop. */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-[#E5E7EB] shadow-sm">
          <button
            type="button"
            onClick={openMenu}
            aria-label="Open menu"
            className="w-10 h-10 rounded-lg text-[#0B1220] hover:bg-[#F8FAFC] flex items-center justify-center"
          >
            <Menu className="w-5 h-5" strokeWidth={2} />
          </button>
          <Link to="/citizen/dashboard" className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-[#2952E3] flex items-center justify-center shadow-sm shrink-0">
              <span className="text-white font-bold text-sm">N</span>
            </div>
            <span className="font-bold text-[#0B1220] text-sm">NIVARAN</span>
          </Link>
          <Link
            to="/citizen/notifications"
            aria-label="Notifications"
            className="ml-auto relative w-10 h-10 rounded-lg text-[#0B1220] hover:bg-[#F8FAFC] flex items-center justify-center"
          >
            <Bell className="w-5 h-5" strokeWidth={2} />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-[#EF4444] text-white text-[10px] font-semibold">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Link>
        </header>

        <main className="flex-1 overflow-auto bg-[#F8FAFC]">
          {children}
        </main>
      </div>
    </div>
  );
}
