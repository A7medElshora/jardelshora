import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type AuthCtx = {
  isAuthed: boolean;
  login: (u: string, p: string) => boolean;
  logout: () => void;
};

const Ctx = createContext<AuthCtx | null>(null);
const KEY = "shora_admin_session_v1";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthed, setIsAuthed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsAuthed(localStorage.getItem(KEY) === "1");
      setReady(true);
    }
  }, []);

  const login = (u: string, p: string) => {
    if (u.trim().toLowerCase() === "admin" && p === "admin") {
      localStorage.setItem(KEY, "1");
      setIsAuthed(true);
      return true;
    }
    return false;
  };
  const logout = () => {
    localStorage.removeItem(KEY);
    setIsAuthed(false);
  };

  if (!ready) return null;
  return <Ctx.Provider value={{ isAuthed, login, logout }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("AuthProvider missing");
  return c;
}
