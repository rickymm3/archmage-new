import React, { createContext, useContext, useState, useEffect } from "react";
import * as api from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Check for existing token on mount
  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      const token = await api.getToken();
      if (token) {
        const data = await api.getMe();
        setUser(data.user);
        setIsAuthenticated(true);
      }
    } catch {
      setIsAuthenticated(false);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }

  async function loginUser(email, password) {
    const data = await api.login(email, password);
    setUser(data.user);
    setIsAuthenticated(true);
    return data;
  }

  async function registerUser(params) {
    const data = await api.register(params);
    setUser(data.user);
    setIsAuthenticated(true);
    return data;
  }

  async function logoutUser() {
    await api.logout();
    setUser(null);
    setIsAuthenticated(false);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated,
        login: loginUser,
        register: registerUser,
        logout: logoutUser,
        refreshUser: checkAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
