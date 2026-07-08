import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, ApiError } from '../../lib/api/client';
import type {
  LoginInput,
  SignupInput,
  User,
} from '@nivaran/shared';

interface MeResponse { user: User | null; }

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  login: (input: LoginInput) => Promise<User>;
  signup: (input: SignupInput) => Promise<User>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const ME_KEY = ['auth', 'me'] as const;

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const meQuery = useQuery<MeResponse>({
    queryKey: ME_KEY,
    queryFn: () => apiClient.get<MeResponse>('/auth/me'),
    // No `staleTime`: the session can be invalidated server-side (logout,
    // expiry, cookie cleared by another tab), and we want every refetch
    // trigger to actually hit the API rather than serve a stale snapshot.
    retry: false,
    refetchOnWindowFocus: true,
  });

  const loginMutation = useMutation<{ user: User }, ApiError, LoginInput>({
    mutationFn: (input) => apiClient.post<{ user: User }>('/auth/login', input),
    onSuccess: ({ user }) => {
      queryClient.setQueryData<MeResponse>(ME_KEY, { user });
      // Drop every cached query that was populated under the previous
      // session's role / scope. Without this, an admin who just logged
      // in could see a leftover empty `complaints` list cached when the
      // user's role was still 'officer'. This is the same broad reset
      // we do on logout, just for the opposite reason.
      void queryClient.invalidateQueries();
    },
  });

  const signupMutation = useMutation<{ user: User }, ApiError, SignupInput>({
    mutationFn: (input) => apiClient.post<{ user: User }>('/auth/signup', input),
    onSuccess: ({ user }) => {
      queryClient.setQueryData<MeResponse>(ME_KEY, { user });
      void queryClient.invalidateQueries();
    },
  });

  const logoutMutation = useMutation<{ ok: true }, ApiError, void>({
    mutationFn: () => apiClient.post<{ ok: true }>('/auth/logout'),
    onSuccess: () => {
      // Mark the session as gone immediately, then drop every cached query
      // so a stale `/auth/me` snapshot can't keep the guards happy.
      queryClient.setQueryData<MeResponse>(ME_KEY, { user: null });
      queryClient.clear();
      // Reset persistent UI prefs that should not survive a logout. The
      // admin "Department scope" filter lives in localStorage so the
      // sidebar selection persists across refreshes — but it must NOT
      // bleed into the next user's session, otherwise an admin returning
      // to a stale departmentId sees an empty dashboard.
      try {
        localStorage.removeItem('admin.departmentScope');
      } catch {
        // Ignore storage errors (private mode / quota); worst case the
        // user just keeps their selection.
      }
    },
  });

  const value: AuthContextValue = {
    user: meQuery.data?.user ?? null,
    isLoading: meQuery.isLoading,
    login: async (input) => (await loginMutation.mutateAsync(input)).user,
    signup: async (input) => (await signupMutation.mutateAsync(input)).user,
    logout: async () => {
      await logoutMutation.mutateAsync();
    },
  };

  // Re-validate the session on history navigation. Browsers restore the
  // rendered page from the bfcache (back-forward cache) when the user hits
  // Back/Forward, which means React doesn't re-mount and the guards never
  // re-run. When a bfcache restore happens (`event.persisted === true`) we
  // do a hard reload so the React tree is rebuilt from scratch — the
  // freshly-mounted guards then call `/auth/me`, see no session, and
  // redirect to the login page. A simple `invalidateQueries` isn't enough
  // because the React tree itself is restored from memory.
  useEffect(() => {
    const handler = (event: PageTransitionEvent) => {
      if (event.persisted) {
        window.location.reload();
      }
    };
    window.addEventListener('pageshow', handler);
    return () => window.removeEventListener('pageshow', handler);
  }, []);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
