import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, tokenStore } from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(tokenStore.get()));

  const refreshUser = useCallback(async () => {
    if (!tokenStore.get()) return setLoading(false);
    try {
      const { user } = await api.get("/auth/me");
      setUser(user);
    } catch {
      tokenStore.clear();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
    const onLogout = () => setUser(null);
    window.addEventListener("rp:logout", onLogout);
    return () => window.removeEventListener("rp:logout", onLogout);
  }, [refreshUser]);

  const login = async (email, password) => {
    const { token, user } = await api.post("/auth/login", { email, password });
    tokenStore.set(token);
    setUser(user);
    return user;
  };

  const register = async (name, email, password) => {
    const { token, user } = await api.post("/auth/register", { name, email, password });
    tokenStore.set(token);
    setUser(user);
    return user;
  };

  const logout = () => {
    tokenStore.clear();
    localStorage.removeItem("rp_store");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

export const homePathFor = (role) =>
  role === "admin" ? "/admin" : role === "manager" ? "/manager" : "/shop";
