import { createContext, useContext, useState, useEffect, useCallback } from "react";
import api, { getApiErrorMessage } from "../services/api";

const AuthContext = createContext(null);

export const TOKEN_STORAGE_KEY = "smart_associate_token";
export const USER_STORAGE_KEY = "smart_associate_user";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem(USER_STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_STORAGE_KEY));
  const [loading, setLoading] = useState(true);

  /**
   * Clears all session credentials from state and localStorage
   */
  const clearSession = useCallback(() => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
    localStorage.removeItem("smartAssociateLoggedIn");
    sessionStorage.removeItem("smartAssociateLoggedIn");
    setToken(null);
    setUser(null);
  }, []);

  /**
   * Restores and validates session on initial mount by checking GET /api/auth/me
   */
  useEffect(() => {
    let isMounted = true;

    async function restoreSession() {
      const existingToken = localStorage.getItem(TOKEN_STORAGE_KEY);

      if (!existingToken) {
        if (isMounted) {
          clearSession();
          setLoading(false);
        }
        return;
      }

      try {
        // Validate token and fetch fresh profile from database
        const response = await api.get("/api/auth/me");
        if (isMounted) {
          setUser(response.data);
          setToken(existingToken);
          localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(response.data));
          localStorage.setItem("smartAssociateLoggedIn", "true");
        }
      } catch (err) {
        // If token expired or invalid (HTTP 401 or network failure)
        console.warn("Session validation failed:", err.message);
        if (isMounted) {
          clearSession();
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    restoreSession();

    // Listen to unauthorized event dispatched by Axios interceptor
    const handleUnauthorized = () => {
      clearSession();
    };

    window.addEventListener("auth:unauthorized", handleUnauthorized);

    return () => {
      isMounted = false;
      window.removeEventListener("auth:unauthorized", handleUnauthorized);
    };
  }, [clearSession]);

  /**
   * Authenticate user with email and password via POST /api/auth/login
   */
  const login = async (email, password) => {
    try {
      const response = await api.post("/api/auth/login", {
        email: email.trim().toLowerCase(),
        password,
      });

      const { access_token, user: loggedInUser } = response.data;

      // Save credentials in localStorage
      localStorage.setItem(TOKEN_STORAGE_KEY, access_token);
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(loggedInUser));
      localStorage.setItem("smartAssociateLoggedIn", "true");

      // Update state
      setToken(access_token);
      setUser(loggedInUser);

      return {
        success: true,
        user: loggedInUser,
      };
    } catch (err) {
      const message = getApiErrorMessage(err);
      return {
        success: false,
        error: message,
      };
    }
  };

  /**
   * Log out user and purge session
   */
  const logout = () => {
    clearSession();
  };

  /**
   * Re-fetches the current employee profile from /api/auth/me
   */
  const refreshProfile = async () => {
    try {
      const response = await api.get("/api/auth/me");
      setUser(response.data);
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(response.data));
      return response.data;
    } catch (err) {
      clearSession();
      throw err;
    }
  };

  /**
   * Checks whether the current user matches any of the given roles
   * @param {string | string[]} roles - e.g. "admin" or ["admin", "manager"]
   */
  const hasRole = (roles) => {
    if (!user || !user.role) return false;
    const currentRole = user.role.toLowerCase();

    if (Array.isArray(roles)) {
      return roles.map((r) => r.toLowerCase()).includes(currentRole);
    }

    return currentRole === String(roles).toLowerCase();
  };

  const value = {
    user,
    token,
    isAuthenticated: Boolean(user && token),
    loading,
    role: user?.role || null,
    isAdmin: user?.role?.toLowerCase() === "admin",
    isManager: user?.role?.toLowerCase() === "manager",
    isStaff: user?.role?.toLowerCase() === "staff",
    hasRole,
    login,
    logout,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export default AuthContext;
