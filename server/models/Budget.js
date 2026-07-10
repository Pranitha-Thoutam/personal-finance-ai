const mongoose = require("mongoose");

const budgetSchema = new mongoose.Schema(
  {
    // "YYYY-MM" format — e.g. "2025-04"
    // One budget document exists per month; enforced by the unique index below.
    month: {
      type: String,
      required: [true, "Month is required"],
      trim: true,
      match: [
        /^\d{4}-(0[1-9]|1[0-2])$/,
        'Month must be in "YYYY-MM" format (e.g. "2025-04")',
      ],
    },

    monthlyBudget: {
      type: Number,
      required: [true, "Monthly budget amount is required"],
      min: [0, "Budget cannot be negative"],
    },

    // Per-category budget limits — optional but useful for the Budget page
    // Stored as a plain object: { Food: 600, Transport: 400, … }
    categoryLimits: {
      type: Map,
      of: Number,
      default: {},
    },

    note: {
      type: String,
      trim: true,
      maxlength: [200, "Note cannot exceed 200 characters"],
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

// One budget per month — prevents accidental duplicates
budgetSchema.index({ month: 1 }, { unique: true });

module.exports = mongoose.model("Budget", budgetSchema);
