import { createContext, useContext, useState } from "react";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const savedUser = sessionStorage.getItem("user");

    if (!savedUser || sessionStorage.getItem("authVersion") !== "2") {
      sessionStorage.removeItem("user");
      sessionStorage.removeItem("token");
      return null;
    }

    try {
      return JSON.parse(savedUser);
    } catch {
      sessionStorage.removeItem("user");
      sessionStorage.removeItem("token");
      return null;
    }
  });

  function login(userData, token) {
    sessionStorage.setItem("authVersion", "2");
    sessionStorage.setItem("token", token);
    sessionStorage.setItem("user", JSON.stringify(userData));
    setUser(userData);
  }

  function logout() {
    sessionStorage.removeItem("authVersion");
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}