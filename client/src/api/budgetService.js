import api from "./axiosInstance";

// GET /api/budget?month=YYYY-MM
export const fetchBudget = (month) =>
  api.get("/budget", { params: month ? { month } : {} });

// POST /api/budget
export const saveBudget = (payload) =>
  api.post("/budget", payload);
