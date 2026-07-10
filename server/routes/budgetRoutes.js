const express = require("express");
const router  = express.Router();

const {
  setBudget,
  getBudget,
  getAllBudgets,
} = require("../controllers/budgetController");

// POST  /api/budget          → set or update budget for a month
// GET   /api/budget          → get budget for current month (or ?month=YYYY-MM)
// GET   /api/budget/all      → list last N monthly budgets

router.post("/",    setBudget);
router.get  ("/all", getAllBudgets);   // must come before "/:id" style routes
router.get  ("/",   getBudget);

module.exports = router;
