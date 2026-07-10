import api from "./axiosInstance";

// POST /api/chat
// payload: { message: string, history: Array<{role, content}> }
export const sendChatMessage = (payload) =>
  api.post("/chat", payload);
