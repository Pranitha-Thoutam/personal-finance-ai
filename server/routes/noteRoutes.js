const express = require("express");
const router  = express.Router();

const { addNote, getAllNotes, deleteNote } = require("../controllers/noteController");

// POST   /api/notes        → add a note
// GET    /api/notes        → get all notes (supports ?tag=)
// DELETE /api/notes/:id    → delete note by id

router.post  ("/",    addNote);
router.get   ("/",    getAllNotes);
router.delete("/:id", deleteNote);

module.exports = router;
