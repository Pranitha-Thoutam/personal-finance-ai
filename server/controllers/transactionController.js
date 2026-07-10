const Transaction = require("../models/Transaction");

/* ─────────────────────────────────────────────
   POST /api/transactions
   Create a new transaction
───────────────────────────────────────────── */
const addTransaction = async (req, res) => {
  try {
    const { type, amount, category, date, note } = req.body;

    // Basic presence check before Mongoose validation
    if (!type || !amount || !category || !date) {
      return res.status(400).json({
        success: false,
        message: "type, amount, category, and date are required",
      });
    }

    const transaction = await Transaction.create({
      type,
      amount,
      category,
      date,
      note: note || "",
    });

    res.status(201).json({
      success: true,
      message: "Transaction added successfully",
      data: transaction,
    });
  } catch (error) {
    // Mongoose validation errors
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({
        success: false,
        message: messages.join(", "),
      });
    }

    res.status(500).json({
      success: false,
      message: "Server error while adding transaction",
      error: error.message,
    });
  }
};

/* ─────────────────────────────────────────────
   GET /api/transactions
   Fetch all transactions, newest first
   Optional query params:
     ?type=income|expense
     ?category=Food
     ?sortBy=date|amount  (default: date)
     ?order=asc|desc      (default: desc)
───────────────────────────────────────────── */
const getAllTransactions = async (req, res) => {
  try {
    const { type, category, sortBy = "date", order = "desc" } = req.query;

    // Build filter object
    const filter = {};
    if (type && ["income", "expense"].includes(type)) filter.type = type;
    if (category) filter.category = { $regex: new RegExp(category, "i") };

    // Build sort object
    const sortOrder = order === "asc" ? 1 : -1;
    const validSortFields = ["date", "amount", "createdAt"];
    const sortField = validSortFields.includes(sortBy) ? sortBy : "date";
    const sort = { [sortField]: sortOrder };

    const transactions = await Transaction.find(filter).sort(sort);

    // Aggregate summary
    const summary = {
      totalIncome: 0,
      totalExpense: 0,
      count: transactions.length,
    };

    transactions.forEach((t) => {
      if (t.type === "income")  summary.totalIncome  += t.amount;
      if (t.type === "expense") summary.totalExpense += t.amount;
    });

    summary.netBalance = summary.totalIncome - summary.totalExpense;

    res.status(200).json({
      success: true,
      summary,
      data: transactions,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error while fetching transactions",
      error: error.message,
    });
  }
};

/* ─────────────────────────────────────────────
   DELETE /api/transactions/:id
   Delete a single transaction by MongoDB _id
───────────────────────────────────────────── */
const deleteTransaction = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ObjectId format
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid transaction ID format",
      });
    }

    const transaction = await Transaction.findByIdAndDelete(id);

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: "Transaction not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Transaction deleted successfully",
      data: { id: transaction._id },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error while deleting transaction",
      error: error.message,
    });
  }
};

module.exports = {
  addTransaction,
  getAllTransactions,
  deleteTransaction,
};
