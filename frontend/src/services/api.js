import axios from "axios";

const api = axios.create({
  baseURL: "http://127.0.0.1:8000",
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 10000,
});

// Request Interceptor: Attach JWT Bearer Token if present
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("smart_associate_token");

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Handle 401 Unauthorized expired sessions
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Check if the response is 401 Unauthorized and not the login request itself
    if (
      error.response &&
      error.response.status === 401 &&
      !error.config.url.includes("/api/auth/login")
    ) {
      // Clear token to prevent infinite invalid requests
      localStorage.removeItem("smart_associate_token");
      localStorage.removeItem("smart_associate_user");
      localStorage.removeItem("smartAssociateLoggedIn");

      // Notify application of unauthorized state
      window.dispatchEvent(new CustomEvent("auth:unauthorized"));
    }

    return Promise.reject(error);
  }
);

/**
 * Extracts a friendly user-facing error message from an Axios error
 */
export function getApiErrorMessage(error) {
  if (!error) return "An unexpected error occurred.";

  if (error.response?.data?.detail) {
    const detail = error.response.data.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      return detail.map((d) => d.msg || d).join(", ");
    }
  }

  if (error.code === "ECONNABORTED" || error.message?.includes("timeout")) {
    return "Request timed out. Please check your backend connection.";
  }

  if (!error.response && error.request) {
    return "Cannot reach the FastAPI server. Please ensure the backend is running on http://127.0.0.1:8000.";
  }

  return error.message || "Failed to communicate with the server.";
}

export default api;
