// src/context/AuthContext.js
import { createContext, useEffect, useState } from "react";
import { getUserItem, setUserItem } from "../../utils/storage";

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // ✅ Load user + token from storage on mount
  useEffect(() => {
  const loadAuth = async () => {
    try {
      const storedUser = await getUserItem("user");
      const storedToken = await getUserItem("token");

      // if no token => logged out
      if (!storedToken) {
        setUser(null);
        setToken(null);
        return;
      }

      // 🔥 if token exists but no user => create fallback user object
      if (!storedUser) {
        console.log("🔄 Restoring missing user key from token...");

        // Minimal placeholder profile using token until backend profile is fetched
        const recoveredUser = {
          id: storedToken, // fallback unique base
          name: "User",
          email: "unknown",
        };

        await setUserItem("user", recoveredUser);
        setUser(recoveredUser);
        setToken(storedToken);

        return;
      }

      // Normal case
      setUser(storedUser);
      setToken(storedToken);
    } catch (err) {
      console.error("Auth check failed:", err);
    } finally {
      setLoading(false);
    }
  };

  loadAuth();
}, []);


  // ✅ Persist on change (optional)
useEffect(() => {
  if (typeof token === "string" && user && user.id) {
    setUserItem("user", user);
    setUserItem("token", token);
  }
}, [user, token]);


  return (
    <AuthContext.Provider value={{ user, setUser, token, setToken, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
