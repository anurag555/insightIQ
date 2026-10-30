import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [workspaces, setWorkspaces] = useState([]);
  const [activeWorkspace, setActiveWorkspaceState] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchCurrentUser = async () => {
    try {
      const res = await api.get('/auth/me');
      if (res.data.success) {
        setUser(res.data.user);
        setWorkspaces(res.data.workspaces || []);

        const savedWsId = localStorage.getItem('insightiq_workspace_id');
        let selectedWs = null;

        if (savedWsId) {
          selectedWs = res.data.workspaces.find(w => w._id === savedWsId);
        }
        if (!selectedWs && res.data.workspaces.length > 0) {
          selectedWs = res.data.workspaces[0];
        }

        if (selectedWs) {
          setActiveWorkspaceState(selectedWs);
          localStorage.setItem('insightiq_workspace_id', selectedWs._id);
        }
      }
    } catch (err) {
      setUser(null);
      setWorkspaces([]);
      setActiveWorkspaceState(null);
      localStorage.removeItem('insightiq_token');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    if (res.data.success) {
      localStorage.setItem('insightiq_token', res.data.token);
      setUser(res.data.user);
      if (res.data.workspace) {
        setActiveWorkspaceState(res.data.workspace);
        localStorage.setItem('insightiq_workspace_id', res.data.workspace._id);
      }
      await fetchCurrentUser();
      return res.data;
    }
    throw new Error(res.data.error || 'Login failed');
  };

  const register = async (name, email, password) => {
    const res = await api.post('/auth/register', { name, email, password });
    if (res.data.success) {
      localStorage.setItem('insightiq_token', res.data.token);
      setUser(res.data.user);
      if (res.data.workspace) {
        setActiveWorkspaceState(res.data.workspace);
        localStorage.setItem('insightiq_workspace_id', res.data.workspace._id);
      }
      await fetchCurrentUser();
      return res.data;
    }
    throw new Error(res.data.error || 'Registration failed');
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (e) {
      // Ignore network errors on logout
    }
    localStorage.removeItem('insightiq_token');
    localStorage.removeItem('insightiq_workspace_id');
    setUser(null);
    setWorkspaces([]);
    setActiveWorkspaceState(null);
  };

  const setActiveWorkspace = (ws) => {
    setActiveWorkspaceState(ws);
    if (ws && ws._id) {
      localStorage.setItem('insightiq_workspace_id', ws._id);
    } else {
      localStorage.removeItem('insightiq_workspace_id');
    }
  };

  const refreshWorkspaces = async () => {
    try {
      const res = await api.get('/workspaces');
      if (res.data.success) {
        setWorkspaces(res.data.workspaces);
      }
    } catch (e) {
      console.error('Failed to refresh workspaces:', e);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        workspaces,
        activeWorkspace,
        isAuthenticated: Boolean(user),
        isLoading,
        login,
        register,
        logout,
        setActiveWorkspace,
        refreshWorkspaces,
        fetchCurrentUser
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
