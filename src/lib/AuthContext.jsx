import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { apiRequest, apiClient } from '@/api/client';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [authError, setAuthError] = useState(null);

  const checkUserAuth = useCallback(async () => {
    setIsLoadingAuth(true);
    setAuthError(null);
    try {
      const currentUser = await apiClient.auth.me();
      setUser(currentUser);
      setIsAuthenticated(true);
    } catch (error) {
      setUser(null);
      setIsAuthenticated(false);
      if (error.status !== 401) {
        setAuthError({ type: 'unknown', message: error.message });
      }
    } finally {
      setIsLoadingAuth(false);
      setAuthChecked(true);
    }
  }, []);

  useEffect(() => {
    checkUserAuth();
  }, [checkUserAuth]);

  const login = async (email, password) => {
    const result = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setUser(result.user);
    setIsAuthenticated(true);
    setAuthError(null);
    setAuthChecked(true);
    return result.user;
  };

  const completeInvitation = async (token, password) => {
    const result = await apiRequest('/auth/invitations/complete', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    });
    setUser(result.user);
    setIsAuthenticated(true);
    setAuthError(null);
    setAuthChecked(true);
    return result.user;
  };

  const logout = async () => {
    setUser(null);
    setIsAuthenticated(false);
    await apiClient.auth.logout();
  };

  const navigateToLogin = () => window.location.assign('/login');

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoadingAuth,
      isLoadingPublicSettings: isLoadingAuth,
      authChecked,
      authError,
      appPublicSettings: null,
      login,
      completeInvitation,
      logout,
      navigateToLogin,
      checkUserAuth,
      checkAppState: checkUserAuth,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
