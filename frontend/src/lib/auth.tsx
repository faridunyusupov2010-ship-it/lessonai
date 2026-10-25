"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, getToken, setToken, type Teacher, type UILang } from "./api";
import { useI18n } from "./i18n";

interface AuthState {
  teacher: Teacher | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (b: { email: string; password: string; full_name: string; ui_language: UILang }) => Promise<void>;
  logout: () => void;
  changeLanguage: (l: UILang) => void;
}

const AuthCtx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setLang } = useI18n();
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    if (!getToken()) {
      setLoading(false);
      return;
    }
    api
      .me()
      .then((t) => alive && setTeacher(t))
      .catch(() => setToken(null))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const r = await api.login(email, password);
      setToken(r.access_token);
      setTeacher(r.teacher);
      setLang(r.teacher.ui_language);
    },
    [setLang],
  );

  const register = useCallback(
    async (b: { email: string; password: string; full_name: string; ui_language: UILang }) => {
      const r = await api.register(b);
      setToken(r.access_token);
      setTeacher(r.teacher);
      setLang(r.teacher.ui_language);
    },
    [setLang],
  );

  const logout = useCallback(() => {
    setToken(null);
    setTeacher(null);
  }, []);

  // Забони интерфейс ва забони шарҳҳои AI якхела мемонанд
  const changeLanguage = useCallback(
    (l: UILang) => {
      setLang(l);
      if (getToken()) {
        api
          .updateMe({ ui_language: l })
          .then(setTeacher)
          .catch(() => {});
      }
    },
    [setLang],
  );

  const value = useMemo(
    () => ({ teacher, loading, login, register, logout, changeLanguage }),
    [teacher, loading, login, register, logout, changeLanguage],
  );
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
