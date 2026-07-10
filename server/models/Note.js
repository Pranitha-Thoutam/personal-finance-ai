const mongoose = require("mongoose");

const noteSchema = new mongoose.Schema(
  {
    text: {
      type:      String,
      required:  [true, "Note text is required"],
      trim:      true,
      maxlength: [1000, "Note cannot exceed 1000 characters"],
    },

    // Optional tag / label for grouping (e.g. "goal", "reminder", "idea")
    tag: {
      type:    String,
      trim:    true,
      default: "",
      maxlength: [30, "Tag cannot exceed 30 characters"],
    },
  },
  {
    timestamps: true, // provides createdAt and updatedAt automatically
  }
);

module.exports = mongoose.model("Note", noteSchema);
