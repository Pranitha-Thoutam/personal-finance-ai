const express = require("express");
const router  = express.Router();

const {
  addTransaction,
  getAllTransactions,
  deleteTransaction,
} = require("../controllers/transactionController");

// POST   /api/transactions       → create transaction
// GET    /api/transactions       → get all transactions (supports ?type, ?category, ?sortBy, ?order)
// DELETE /api/transactions/:id   → delete transaction by id

router.post  ("/",    addTransaction);
router.get   ("/",    getAllTransactions);
router.delete("/:id", deleteTransaction);

module.exports = router;
