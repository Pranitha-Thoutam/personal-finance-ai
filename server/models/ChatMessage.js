const mongoose = require("mongoose");

const chatMessageSchema = new mongoose.Schema(
  {
    role: {
      type:     String,
      enum:     ["user", "assistant"],
      required: [true, "role is required"],
    },
    message: {
      type:      String,
      required:  [true, "message is required"],
      trim:      true,
      maxlength: [2000, "Message cannot exceed 2000 characters"],
    },
  },
  {
    timestamps: true, // createdAt + updatedAt
  }
);

// Index for fast chronological retrieval
chatMessageSchema.index({ createdAt: 1 });

module.exports = mongoose.model("ChatMessage", chatMessageSchema);
