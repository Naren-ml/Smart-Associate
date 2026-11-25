
import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const resolvedApiBaseUrl =
  API_BASE_URL ||
  (import.meta.env.DEV ? "http://127.0.0.1:8000" : "https://smart-associate.onrender.com");

const api = axios.create({
  baseURL: resolvedApiBaseUrl,
  headers: {
    "Content-Type": "application/json",
  },
});

export function getApiErrorMessage(error) {
  return error?.response?.data?.detail || error?.response?.data?.message || error?.message || "Something went wrong. Please try again.";
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("smart_associate_token") || localStorage.getItem("smartAssociateToken");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

export default api;
