import api from "./axiosInstance";

// GET /api/notes
export const fetchNotes = () =>
  api.get("/notes");

// POST /api/notes
export const createNote = (payload) =>
  api.post("/notes", payload);

// DELETE /api/notes/:id
export const removeNote = (id) =>
  api.delete(`/notes/${id}`);
