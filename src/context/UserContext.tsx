import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { UserActiveMode, UserProfile } from '../types';
import { loadUserProgress, saveUserProgress } from '../services/localStorageService';
import {
  login, signup, logout, restoreSession, forgotPassword, setActiveMode as persistActiveMode,
  refreshSessionRoles,
} from '../services/authService';
import { notificationService } from '../services/notificationService';
import { apiClient } from '../services/api/client';
import { clearMonitoringUser, setMonitoringUser, trackAuthEvent, trackRoleSwitch } from '../services/monitoring';

interface UserContextType {
  user: UserProfile;
  isAuthenticated: boolean;
  isGuest: boolean;
  /** True only while restoring session on app boot — blocks the root navigator. */
  isInitializing: boolean;
  /** True while a login/signup request is in flight — for button spinners only. */
  authLoading: boolean;
  isStorageLoaded: boolean;
  isLoggingOut: boolean;
  setUser: React.Dispatch<React.SetStateAction<UserProfile>>;
  setIsAuthenticated: React.Dispatch<React.SetStateAction<boolean>>;
  onLogin: (email: string, password: string) => Promise<boolean>;
  onSignup: (name: string, email: string, password: string) => Promise<boolean>;
  onLogout: () => Promise<void>;
  onGuestContinue: () => void;
  onForgotPassword: (email: string) => Promise<boolean>;
  setActiveMode: (mode: UserActiveMode) => Promise<void>;
  /** Temporary compatibility alias for mode switching. */
  setActiveRole: (role: UserActiveMode) => Promise<void>;
  /** Re-fetch JWT roles + profile from server (after specialty approval). */
  refreshSession: () => Promise<void>;
  handleResetProgress: () => void;
}

function roleForActiveMode(mode: UserActiveMode, fallback: UserProfile['role']): UserProfile['role'] {
  switch (mode) {
    case 'USER':
      return 'tourist';
    case 'VENDOR':
      return 'vendor';
    case 'CONTENT_CREATOR':
      return 'creator';
    case 'ADMIN':
      return 'admin';
    default:
      return fallback;
  }
}

function canActivateWorkspace(user: UserProfile, mode: UserActiveMode): boolean {
  const approved = (user.roles || []).map((r) => String(r).toUpperCase());
  const permission = String(user.permission || '').toUpperCase();
  const creatorApproved =
    approved.includes('CONTENT_CREATOR') ||
    permission === 'CONTENT_CREATOR' ||
    user.creatorProfile?.status === 'APPROVED';
  const vendorStatus = String((user as any)?.vendor?.status || '').toUpperCase();
  const vendorApproved =
    approved.includes('VENDOR') ||
    permission === 'VENDOR' ||
    vendorStatus === 'APPROVED';

  return (
    mode === 'USER' ||
    (mode === 'CONTENT_CREATOR' && creatorApproved) ||
    (mode === 'VENDOR' && vendorApproved) ||
    (mode === 'ADMIN' && (approved.includes('ADMIN') || permission === 'ADMIN'))
  );
}

function GuestUser(): UserProfile {
  return {
    uid: 'guest-user',
    email: '',
    phoneNumber: '',
    displayName: 'Guest User',
    avatarStyle: 0,
    role: 'tourist',
    roles: ['USER'],
    permission: 'USER',
    activeMode: 'USER',
    activeRole: 'USER',
    totalPoints: 0,
    visitedSpots: [],
    currentItinerary: [],
    completedItineraryStops: [],
    completedActivities: [],
    redemptions: [],
    createdAt: Date.now(),
    lastActive: Date.now(),
  };
}

const UserContext = createContext<UserContextType | null>(null);

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile>(() => GuestUser());
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [isStorageLoaded, setIsStorageLoaded] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    apiClient.onAuthExpired(() => {
      setUser(GuestUser());
      setIsAuthenticated(false);
    });
    return () => apiClient.onAuthExpired(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const timeout = setTimeout(() => {
      if (cancelled) return;
      console.warn('[UserContext] Loading timed out — showing app with defaults');
      setIsStorageLoaded(true);
      setIsInitializing(false);
    }, 15000);

    (async () => {
      try {
        const saved = await loadUserProgress();
        if (cancelled) return;
        if (saved) {
          setUser({ ...GuestUser(), ...saved, lastActive: Date.now() });
        }
      } catch (err) {
        console.warn('[UserContext] Failed to load saved user progress:', err);
      }
      if (cancelled) return;
      setIsStorageLoaded(true);

      const sessionUser = await restoreSession();
      if (cancelled) return;
      if (sessionUser) {
        setUser(prev => ({ ...prev, ...sessionUser }));
        setIsAuthenticated(true);
        trackAuthEvent('session_restored', { mode: sessionUser.activeMode || sessionUser.activeRole });
        notificationService.syncDeviceAfterSessionRestore().catch((err) => {
          console.warn('[UserContext] Token sync on session restore failed:', err);
        });
      }
      if (cancelled) return;
      setIsInitializing(false);
      clearTimeout(timeout);
    })();
    return () => { cancelled = true; clearTimeout(timeout); };
  }, []);

  useEffect(() => {
    if (isStorageLoaded) saveUserProgress(user);
  }, [user, isStorageLoaded]);

  useEffect(() => {
    if (!isAuthenticated) {
      clearMonitoringUser();
      return;
    }
    setMonitoringUser({
      id: user.uid,
      role: user.permission,
      activeMode: user.activeMode || user.activeRole,
      roles: user.roles,
    });
  }, [
    isAuthenticated,
    user.uid,
    user.permission,
    user.activeMode,
    user.activeRole,
    user.roles,
  ]);

  const onLogin = useCallback(async (email: string, password: string): Promise<boolean> => {
    setAuthLoading(true);
    try {
      const result = await login(email, password);
      if (result) {
        setUser(prev => ({ ...prev, ...result.user }));
        setIsAuthenticated(true);
        trackAuthEvent('login', { mode: result.user.activeMode || result.user.activeRole });

        notificationService.requestPermission().then((granted) => {
          if (granted) {
            notificationService.registerDeviceToken().catch((err) => {
              console.warn('[UserContext] Failed to register device token on login:', err);
            });
          }
        }).catch((err) => {
          console.warn('[UserContext] Notification permission request failed on login:', err);
        });

        return true;
      }
      return false;
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const onSignup = useCallback(async (name: string, email: string, password: string): Promise<boolean> => {
    setAuthLoading(true);
    try {
      const result = await signup(name, email, password);
      if (result) {
        setUser(prev => ({ ...prev, ...result.user }));
        setIsAuthenticated(true);
        trackAuthEvent('signup', { mode: result.user.activeMode || result.user.activeRole });

        notificationService.requestPermission().then((granted) => {
          if (granted) {
            notificationService.registerDeviceToken().catch((err) => {
              console.warn('[UserContext] Failed to register device token on signup:', err);
            });
          }
        }).catch((err) => {
          console.warn('[UserContext] Notification permission request failed on signup:', err);
        });

        return true;
      }
      return false;
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const onLogout = useCallback(async () => {
    trackAuthEvent('logout');
    notificationService.unregisterDeviceToken().catch(() => {});
    logout().catch(() => {});
    clearMonitoringUser();
    setUser(GuestUser());
    setIsAuthenticated(false);
    setIsLoggingOut(true);
    setTimeout(() => setIsLoggingOut(false), 500);
  }, []);

  const onGuestContinue = useCallback(() => {
    setUser(GuestUser());
    setIsAuthenticated(true);
    trackAuthEvent('guest');
    setMonitoringUser({ id: 'guest-user', role: 'GUEST', activeMode: 'USER' });
  }, []);

  const onForgotPassword = useCallback(async (email: string): Promise<boolean> => {
    return forgotPassword(email);
  }, []);

  const refreshSession = useCallback(async () => {
    if (!isAuthenticated || user.uid === 'guest-user') return;
    const profile = await refreshSessionRoles();
    if (profile) {
      setUser((prev) => ({
        ...prev,
        ...profile,
        creatorProfile: profile.creatorProfile ?? prev.creatorProfile,
        vendor: profile.vendor ?? prev.vendor,
      }));
    }
  }, [isAuthenticated, user.uid]);

  useEffect(() => {
    if (!isAuthenticated || user.uid === 'guest-user') return;
    const onChange = (state: AppStateStatus) => {
      if (state === 'active') {
        refreshSession().catch(() => undefined);
      }
    };
    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, [isAuthenticated, user.uid, refreshSession]);

  const setActiveMode = useCallback(async (mode: UserActiveMode) => {
    if (!isAuthenticated || user.uid === 'guest-user') {
      throw new Error('Sign in to switch workspace.');
    }

    const previousMode = (user.activeMode || user.activeRole || 'USER') as UserActiveMode;
    if (previousMode === mode) return;

    trackRoleSwitch(previousMode, mode);

    if (!canActivateWorkspace(user, mode)) {
      throw new Error('This workspace is not available for your account.');
    }

    const nextRole = roleForActiveMode(mode, user.role);

    // Switch shell immediately — don't block UI on network.
    setUser((prev) => ({
      ...prev,
      activeMode: mode,
      activeRole: mode,
      role: nextRole,
    }));

    const revertMode = () => {
      setUser((prev) => ({
        ...prev,
        activeMode: previousMode,
        activeRole: previousMode,
        role: roleForActiveMode(previousMode, prev.role),
      }));
    };

    const applyServerProfile = (updated: UserProfile) => {
      setUser((prev) => ({
        ...prev,
        ...updated,
        roles: updated.roles?.length ? updated.roles : prev.roles,
        permission: updated.permission || prev.permission,
        creatorProfile: updated.creatorProfile ?? prev.creatorProfile,
        vendor: updated.vendor ?? prev.vendor,
        activeMode: (updated.activeMode || mode) as UserActiveMode,
        activeRole: (updated.activeMode || mode) as UserActiveMode,
        role: nextRole,
      }));
    };

    const syncMode = async () => {
      try {
        const updated = await persistActiveMode(mode);
        applyServerProfile(updated);
        return;
      } catch (firstErr) {
        // JWT may be stale right after specialty approval — refresh once, then retry.
        if (mode !== 'USER') {
          try {
            const profile = await refreshSessionRoles();
            if (profile) {
              const updated = await persistActiveMode(mode);
              applyServerProfile(updated);
              return;
            }
          } catch {
            // fall through to revert
          }
        }
        revertMode();
        console.warn('[UserContext] setActiveMode sync failed:', firstErr);
        throw firstErr;
      }
    };

    void syncMode().catch(() => undefined);
  }, [isAuthenticated, user]);

  const handleResetProgress = useCallback(() => {
    setUser(GuestUser());
  }, []);

  const isGuest = user.uid === 'guest-user';

  return (
    <UserContext.Provider value={{
      user, isAuthenticated, isGuest, isInitializing, authLoading, isStorageLoaded, isLoggingOut,
      setUser, setIsAuthenticated, onLogin, onSignup, onLogout, onGuestContinue,
      onForgotPassword, setActiveMode, setActiveRole: setActiveMode, refreshSession, handleResetProgress,
    }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUserContext(): UserContextType {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useUserContext must be used within UserProvider');
  return ctx;
}
