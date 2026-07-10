const Note = require("../models/Note");

/* ─────────────────────────────────────────────
   POST /api/notes
   Create a new note.
   Body: { text: string, tag?: string }
───────────────────────────────────────────── */
const addNote = async (req, res) => {
  try {
    const { text, tag } = req.body;

    if (!text || typeof text !== "string" || !text.trim()) {
      return res.status(400).json({
        success: false,
        message: "text is required and must be a non-empty string",
      });
    }

    if (text.trim().length > 1000) {
      return res.status(400).json({
        success: false,
        message: "Note text cannot exceed 1000 characters",
      });
    }

    const note = await Note.create({
      text: text.trim(),
      tag:  tag ? tag.trim() : "",
    });

    res.status(201).json({
      success: true,
      message: "Note added successfully",
      data:    note,
    });
  } catch (error) {
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map(e => e.message);
      return res.status(400).json({ success: false, message: messages.join(", ") });
    }

    res.status(500).json({
      success: false,
      message: "Server error while adding note",
      error:   process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/* ─────────────────────────────────────────────
   GET /api/notes
   Return all notes, newest first.
   Optional query: ?tag=goal
───────────────────────────────────────────── */
const getAllNotes = async (req, res) => {
  try {
    const { tag } = req.query;

    const filter = {};
    if (tag) filter.tag = { $regex: new RegExp(tag.trim(), "i") };

    const notes = await Note.find(filter).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count:   notes.length,
      data:    notes,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error while fetching notes",
      error:   process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/* ─────────────────────────────────────────────
   DELETE /api/notes/:id
   Delete a single note by MongoDB _id.
───────────────────────────────────────────── */
const deleteNote = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid note ID format",
      });
    }

    const note = await Note.findByIdAndDelete(id);

    if (!note) {
      return res.status(404).json({
        success: false,
        message: "Note not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Note deleted successfully",
      data:    { id: note._id },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error while deleting note",
      error:   process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

module.exports = { addNote, getAllNotes, deleteNote };
