import axios from "axios";

// Base URL reads from Vite env var; falls back to localhost for development.
// In your .env file add: VITE_API_URL=http://localhost:5000/api
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api",
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 10000, // 10 s — avoids hanging requests
});

// ── Request interceptor ──────────────────────
// Good place to attach auth tokens later (e.g. Bearer JWT).
api.interceptors.request.use(
  (config) => config,
  (error) => Promise.reject(error)
);

// ── Response interceptor ─────────────────────
// Unwrap the nested `data` field so callers get the payload directly.
// All our backend responses look like: { success, message, data, summary }
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Attach a clean human-readable message to every error
    const message =
      error.response?.data?.message ||
      (error.code === "ECONNABORTED" ? "Request timed out. Is the server running?" :
      error.message === "Network Error"  ? "Cannot reach the server. Check your connection." :
      "Something went wrong.");

    error.userMessage = message;
    return Promise.reject(error);
  }
);

export default api;
