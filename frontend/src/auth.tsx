import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiGet, apiPost } from "./api";

type User = { id: string; email: string; name: string; role: string };

type AuthCtx = {
  user: User | null | undefined; // undefined = loading
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string, role: string) => Promise<void>;
  logout: () => Promise<void>;
};

const Ctx = createContext<AuthCtx>({} as any);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null | undefined>(undefined);

  useEffect(() => {
    (async () => {
      try {
        const token = await AsyncStorage.getItem("access_token");
        if (!token) return setUser(null);
        const me = await apiGet<User>("/auth/me");
        setUser(me);
      } catch {
        setUser(null);
      }
    })();
  }, []);

  const login = async (email: string, password: string) => {
    const res = await apiPost<{ access_token: string; user: User }>("/auth/login", { email, password });
    await AsyncStorage.setItem("access_token", res.access_token);
    setUser(res.user);
  };

  const register = async (email: string, password: string, name: string, role: string) => {
    const res = await apiPost<{ access_token: string; user: User }>("/auth/register", { email, password, name, role });
    await AsyncStorage.setItem("access_token", res.access_token);
    setUser(res.user);
  };

  const logout = async () => {
    await AsyncStorage.removeItem("access_token");
    setUser(null);
  };

  return <Ctx.Provider value={{ user, login, register, logout }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
