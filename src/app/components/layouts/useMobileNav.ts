import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Tiny hook that powers the mobile drawer on both portal layouts.
 *
 * Responsibilities:
 *   - tracks open / closed state for the off-canvas sidebar
 *   - closes the drawer automatically on route change (so navigating
 *     from the menu doesn't leave it open behind the new page)
 *   - locks the body scroll while the drawer is open so the page
 *     underneath can't be scrolled by accident
 *   - closes the drawer on Escape for keyboard users
 *
 * Desktop is unaffected because every consumer hides the drawer at
 * `lg:` and above; the open state simply has no visible effect there.
 */
export function useMobileNav() {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  // Close on route change
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  // Lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return {
    open,
    openMenu: () => setOpen(true),
    closeMenu: () => setOpen(false),
    toggle: () => setOpen((v) => !v),
  };
}
