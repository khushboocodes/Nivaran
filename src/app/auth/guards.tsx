import { type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthProvider';

type Role = 'citizen' | 'officer' | 'admin';

/**
 * Where to send a signed-in user when they try to visit a route they
 * shouldn't see. Used by every guard so the rule is enforced in one place:
 *   citizen → /citizen/dashboard
 *   officer / admin → /admin/dashboard
 */
function homeForRole(role: Role): string {
  return role === 'citizen' ? '/citizen/dashboard' : '/admin/dashboard';
}

interface RequireAuthProps {
  children: ReactNode;
  /** Where to send unauthenticated users. */
  redirectTo: string;
  /**
   * Optional role allow-list. When set, signed-in users whose role is not
   * in this list are sent to *their* dashboard rather than the login page.
   * Lets the same guard cover "must be signed in" and "must be the right
   * role" cases without a second component.
   */
  roles?: Role[];
}

/**
 * Gate a subtree behind an authenticated session.
 *
 * Behaviour matrix:
 *   - no session                  → redirect to `redirectTo`
 *   - session, no `roles`         → render children
 *   - session, role in `roles`    → render children
 *   - session, role NOT in `roles`→ redirect to that role's home
 *
 * The "wrong role" branch is what enforces the citizen↔admin firewall:
 * an admin who types `/citizen/dashboard` is sent to `/admin/dashboard`,
 * never to the citizen login form.
 */
export function RequireAuth({ children, redirectTo, roles }: RequireAuthProps) {
  const { user, isLoading } = useAuth();
  const location = useLocation();
  if (isLoading) return null;
  if (!user) {
    return <Navigate to={redirectTo} replace state={{ from: location.pathname }} />;
  }
  if (roles && !roles.includes(user.role)) {
    return <Navigate to={homeForRole(user.role)} replace />;
  }
  return <>{children}</>;
}

interface RequireRoleProps {
  children: ReactNode;
  roles: Role[];
  /** Where to send unauthenticated users (signed-in users with the wrong
   *  role are sent to *their* dashboard regardless). */
  redirectTo: string;
}

/**
 * Gate a subtree on having one of the listed roles. Unauthenticated users
 * go to `redirectTo`; signed-in users with a non-matching role are sent
 * to their own dashboard so the back button can never bounce them between
 * portals.
 */
export function RequireRole({ children, roles, redirectTo }: RequireRoleProps) {
  const { user, isLoading } = useAuth();
  const location = useLocation();
  if (isLoading) return null;
  if (!user) {
    return <Navigate to={redirectTo} replace state={{ from: location.pathname }} />;
  }
  if (!roles.includes(user.role)) {
    return <Navigate to={homeForRole(user.role)} replace />;
  }
  return <>{children}</>;
}

interface RedirectIfAuthenticatedProps {
  children: ReactNode;
  /** Where citizens are sent if they're already signed in. */
  citizenTo?: string;
  /** Where officers / admins are sent if they're already signed in. */
  adminTo?: string;
}

/**
 * Inverse of {@link RequireAuth}. Wrap public-only pages (landing, login,
 * signup) so an authenticated user can never see them again until they
 * log out. Without this, pressing Back after signing in would return the
 * user to the login form or marketing page.
 *
 * Combined with the role checks on the protected routes, this means each
 * portal is a sealed room: while signed in you can only see your own
 * portal, and while signed out you can only see the public surface.
 */
export function RedirectIfAuthenticated({
  children,
  citizenTo = '/citizen/dashboard',
  adminTo = '/admin/dashboard',
}: RedirectIfAuthenticatedProps) {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  if (user) {
    const target = user.role === 'citizen' ? citizenTo : adminTo;
    return <Navigate to={target} replace />;
  }
  return <>{children}</>;
}
