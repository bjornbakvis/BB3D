import React, { createContext, useContext, useMemo, useState } from "react";

/**
 * Super-simple auth basis (voor nu):
 * - Nog geen backend, nog geen cookies, nog geen users.
 * - We leggen alleen de structuur klaar zodat we later "echt inloggen" kunnen toevoegen
 *   zonder alles om te bouwen.
 *
 * Belangrijk: dit is expres simpel en transparant.
 */
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const value = useMemo(
    () => ({
      isAuthenticated,
      loginMock: () => setIsAuthenticated(true),
      logoutMock: () => setIsAuthenticated(false),
    }),
    [isAuthenticated]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
