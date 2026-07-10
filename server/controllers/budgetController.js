const Budget      = require("../models/Budget");
const Transaction = require("../models/Transaction");

/* ─────────────────────────────────────────────
   HELPER — derive "YYYY-MM" from a Date object
   or return the current month if none supplied.
───────────────────────────────────────────── */
function currentMonth() {
  const now = new Date();
  const y   = now.getFullYear();
  const m   = String(now.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/* ─────────────────────────────────────────────
   HELPER — fetch spend totals for a given month
   by aggregating the Transaction collection.
───────────────────────────────────────────── */
async function getSpendTotals(month) {
  // month is "YYYY-MM"; match against transaction date range
  const [year, mon] = month.split("-").map(Number);
  const startDate   = new Date(year, mon - 1, 1);          // 1st of month
  const endDate     = new Date(year, mon, 1);               // 1st of next month

  const results = await Transaction.aggregate([
    {
      $match: {
        date: { $gte: startDate, $lt: endDate },
      },
    },
    {
      $group: {
        _id:          "$type",
        total:        { $sum: "$amount" },
      },
    },
  ]);

  const totals = { totalIncome: 0, totalExpense: 0 };
  results.forEach((r) => {
    if (r._id === "income")  totals.totalIncome  = r.total;
    if (r._id === "expense") totals.totalExpense = r.total;
  });
  totals.netBalance = totals.totalIncome - totals.totalExpense;

  // Per-category spend breakdown for the month
  const categoryResults = await Transaction.aggregate([
    {
      $match: {
        type: "expense",
        date: { $gte: startDate, $lt: endDate },
      },
    },
    {
      $group: {
        _id:   "$category",
        spent: { $sum: "$amount" },
      },
    },
    { $sort: { spent: -1 } },
  ]);

  totals.categorySpend = categoryResults.reduce((acc, r) => {
    acc[r._id] = r.spent;
    return acc;
  }, {});

  return totals;
}

/* ─────────────────────────────────────────────
   POST /api/budget
   Create or update the budget for a given month.
   Body: { monthlyBudget, month?, categoryLimits?, note? }
───────────────────────────────────────────── */
const setBudget = async (req, res) => {
  try {
    const { monthlyBudget, month, categoryLimits, note } = req.body;

    // Validate required field
    if (monthlyBudget === undefined || monthlyBudget === null) {
      return res.status(400).json({
        success: false,
        message: "monthlyBudget is required",
      });
    }

    if (typeof monthlyBudget !== "number" || monthlyBudget < 0) {
      return res.status(400).json({
        success: false,
        message: "monthlyBudget must be a non-negative number",
      });
    }

    const targetMonth = month || currentMonth();

    // Validate month format if provided
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(targetMonth)) {
      return res.status(400).json({
        success: false,
        message: 'month must be in "YYYY-MM" format (e.g. "2025-04")',
      });
    }

    // Build update payload — only include fields that were sent
    const updateData = { monthlyBudget };
    if (note          !== undefined) updateData.note           = note;
    if (categoryLimits !== undefined) updateData.categoryLimits = categoryLimits;

    // Upsert: create if not exists, update if exists
    const budget = await Budget.findOneAndUpdate(
      { month: targetMonth },
      { $set: updateData },
      {
        new:    true,   // return the updated document
        upsert: true,   // create if not found
        runValidators: true,
        setDefaultsOnInsert: true,
      }
    );

    // Enrich response with live spend data
    const spendTotals = await getSpendTotals(targetMonth);
    const remaining   = budget.monthlyBudget - spendTotals.totalExpense;
    const usedPct     = budget.monthlyBudget > 0
      ? Math.round((spendTotals.totalExpense / budget.monthlyBudget) * 100)
      : 0;

    res.status(200).json({
      success:   true,
      message:   "Budget saved successfully",
      data:      budget,
      analytics: {
        ...spendTotals,
        remaining,
        usedPercent: usedPct,
      },
    });
  } catch (error) {
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ success: false, message: messages.join(", ") });
    }

    // Duplicate key — race condition on the unique index
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "A budget for this month already exists. Use POST to update it.",
      });
    }

    res.status(500).json({
      success: false,
      message: "Server error while saving budget",
      error:   error.message,
    });
  }
};

/* ─────────────────────────────────────────────
   GET /api/budget
   Fetch budget for a given month (defaults to current).
   Query params: ?month=2025-04
───────────────────────────────────────────── */
const getBudget = async (req, res) => {
  try {
    const targetMonth = req.query.month || currentMonth();

    // Validate month format if provided as query param
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(targetMonth)) {
      return res.status(400).json({
        success: false,
        message: 'month query param must be in "YYYY-MM" format',
      });
    }

    const budget = await Budget.findOne({ month: targetMonth });

    // Fetch live spend totals regardless of whether a budget doc exists
    const spendTotals = await getSpendTotals(targetMonth);

    if (!budget) {
      // Return a useful "no budget set" response with spend data still attached
      return res.status(200).json({
        success:    true,
        budgetSet:  false,
        message:    `No budget set for ${targetMonth}`,
        data:       null,
        analytics:  {
          ...spendTotals,
          remaining:   null,
          usedPercent: null,
        },
      });
    }

    const remaining = budget.monthlyBudget - spendTotals.totalExpense;
    const usedPct   = budget.monthlyBudget > 0
      ? Math.round((spendTotals.totalExpense / budget.monthlyBudget) * 100)
      : 0;

    res.status(200).json({
      success:   true,
      budgetSet: true,
      data:      budget,
      analytics: {
        ...spendTotals,
        remaining,
        usedPercent: usedPct,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error while fetching budget",
      error:   error.message,
    });
  }
};

/* ─────────────────────────────────────────────
   GET /api/budget/all
   List budgets for multiple months (last 12 by default).
───────────────────────────────────────────── */
const getAllBudgets = async (req, res) => {
  try {
    const limit  = Math.min(parseInt(req.query.limit) || 12, 24);
    const budgets = await Budget.find().sort({ month: -1 }).limit(limit);

    res.status(200).json({
      success: true,
      count:   budgets.length,
      data:    budgets,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error while fetching all budgets",
      error:   error.message,
    });
  }
};

module.exports = { setBudget, getBudget, getAllBudgets };
