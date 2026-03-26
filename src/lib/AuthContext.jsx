import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { getMe, logout as authLogout, isLoggedIn, getCachedUser } from '@/api/authClient';
import { syncFromServer } from '@/lib/growth-store';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(getCachedUser);
  const [isAuthenticated, setIsAuthenticated] = useState(isLoggedIn);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalMode, setAuthModalMode] = useState("signup"); // "signup" | "login"

  useEffect(() => {
    checkAppState();
  }, []);

  const checkAppState = async () => {
    setIsLoadingAuth(true);
    if (isLoggedIn()) {
      try {
        const result = await getMe();
        if (result.ok) {
          setUser(result.user);
          setIsAuthenticated(true);
          syncFromServer().catch(() => {});
        } else {
          // Only log out if token was definitively rejected (401)
          // getMe() now handles this internally — if it returns ok:false
          // without clearing auth, keep cached state
          const cached = getCachedUser();
          if (cached && isLoggedIn()) {
            // Token still in localStorage — server may be unreachable, keep cached login
            setUser(cached);
            setIsAuthenticated(true);
          } else {
            setUser(null);
            setIsAuthenticated(false);
          }
        }
      } catch {
        // Network error — keep cached auth state
        const cached = getCachedUser();
        if (cached) {
          setUser(cached);
          setIsAuthenticated(true);
        } else {
          setUser(null);
          setIsAuthenticated(false);
        }
      }
    } else {
      setUser(null);
      setIsAuthenticated(false);
    }
    setIsLoadingAuth(false);
  };

  const logout = useCallback(() => {
    authLogout();
  }, []);

  const navigateToLogin = useCallback((mode = "signup") => {
    setAuthModalMode(mode);
    setShowAuthModal(true);
  }, []);

  const onAuthSuccess = useCallback((userData) => {
    setUser(userData);
    setIsAuthenticated(true);
    setShowAuthModal(false);
    syncFromServer().catch(() => {});
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings: null,
      logout,
      navigateToLogin,
      checkAppState,
      showAuthModal,
      setShowAuthModal,
      authModalMode,
      setAuthModalMode,
      onAuthSuccess,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
