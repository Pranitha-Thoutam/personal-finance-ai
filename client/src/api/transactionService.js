import api from "./axiosInstance";

// GET /api/transactions
export const fetchTransactions = () =>
  api.get("/transactions");

// POST /api/transactions
export const createTransaction = (payload) =>
  api.post("/transactions", payload);

// DELETE /api/transactions/:id
export const removeTransaction = (id) =>
  api.delete(`/transactions/${id}`);
