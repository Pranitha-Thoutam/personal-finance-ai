const Transaction  = require("../models/Transaction");
const Budget       = require("../models/Budget");
const ChatMessage  = require("../models/ChatMessage");

/* ─────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────── */

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function fmtINR(n) {
  return "₹" + Number(n || 0).toLocaleString("en-IN");
}

/* ─────────────────────────────────────────────
   FINANCIAL CONTEXT
   Pulls real data from MongoDB for every request.
───────────────────────────────────────────── */
async function buildFinancialContext() {
  const month = currentMonth();
  const [year, mon] = month.split("-").map(Number);
  const monthStart  = new Date(year, mon - 1, 1);
  const monthEnd    = new Date(year, mon,     1);

  const [allTxns, monthTxns, budget] = await Promise.all([
    Transaction.find().sort({ date: -1 }).limit(100).lean(),
    Transaction.find({ date: { $gte: monthStart, $lt: monthEnd } }).lean(),
    Budget.findOne({ month }).lean(),
  ]);

  const monthIncome  = monthTxns.filter(t => t.type === "income") .reduce((s, t) => s + t.amount, 0);
  const monthExpense = monthTxns.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const totalIncome  = allTxns.filter(t => t.type === "income") .reduce((s, t) => s + t.amount, 0);
  const totalExpense = allTxns.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);

  // Category breakdown for this month — sorted by amount desc
  const categoryMap = {};
  monthTxns.filter(t => t.type === "expense").forEach(t => {
    categoryMap[t.category] = (categoryMap[t.category] || 0) + t.amount;
  });

  const topCategories = Object.entries(categoryMap)
    .sort((a, b) => b[1] - a[1])
    .map(([name, amount]) => ({
      name,
      amount,
      pct: monthExpense > 0 ? Math.round((amount / monthExpense) * 100) : 0,
    }));

  return {
    month,
    monthIncome,
    monthExpense,
    monthNet:    monthIncome - monthExpense,
    totalIncome,
    totalExpense,
    savingsRate: totalIncome > 0
      ? Math.round(((totalIncome - totalExpense) / totalIncome) * 100) : 0,
    topCategories,             // [{ name, amount, pct }]
    recentTxns: allTxns.slice(0, 5),
    budget,                    // budget doc or null
    totalTransactions: allTxns.length,
  };
}

/* ─────────────────────────────────────────────
   INTENT DETECTION
   Maps the user's message to one of 10 intents
   using simple keyword regex — no external API.
───────────────────────────────────────────── */
function detectIntent(msg) {
  const m = msg.toLowerCase();

  if (/saving|save money|how much.*save|savings rate/.test(m))         return "savings";
  if (/expens|spending|spend|where.*money|cost/.test(m))               return "expenses";
  if (/budget|limit|over budget|budget.*left|remaining/.test(m))       return "budget";
  if (/income|earn|salary|how much.*earn|made this month/.test(m))     return "income";
  if (/tip|advice|suggest|improve|better|reduc|cut|lower/.test(m))     return "tips";
  if (/top|most|biggest|highest|largest|category/.test(m))             return "topCategory";
  if (/recent|last|latest|transaction|history|bought|paid/.test(m))    return "recent";
  if (/net|profit|loss|cash flow|balance/.test(m))                     return "netBalance";
  if (/goal|target|plan|projection|forecast/.test(m))                  return "goals";
  if (/hello|hi|hey|how are|what can|help/.test(m))                    return "greeting";

  return "default";
}

/* ─────────────────────────────────────────────
   MOCK RESPONSE ENGINE
   Generates a data-aware response for each intent
   using the user's real MongoDB figures.
───────────────────────────────────────────── */
function generateResponse(message, ctx) {
  const intent = detectIntent(message);
  const {
    monthIncome, monthExpense, monthNet,
    totalIncome, totalExpense, savingsRate,
    topCategories, recentTxns, budget,
    totalTransactions,
  } = ctx;

  const hasData   = totalTransactions > 0;
  const topCat    = topCategories[0];
  const budgetSet = !!budget;
  const remaining = budgetSet ? budget.monthlyBudget - monthExpense : 0;
  const usedPct   = budgetSet && budget.monthlyBudget > 0
    ? Math.round((monthExpense / budget.monthlyBudget) * 100) : 0;

  // No data yet — prompt user to add transactions
  if (!hasData) {
    return "I don't see any transactions yet. Start by adding your income and expenses on the Transactions page — once you have some data I can give you personalised insights and suggestions!";
  }

  switch (intent) {

    case "greeting":
      return `Hi there! I'm Finio AI, your personal finance assistant. I can see you have ${totalTransactions} transaction${totalTransactions !== 1 ? "s" : ""} on record.\n\nThis month you've earned ${fmtINR(monthIncome)} and spent ${fmtINR(monthExpense)}, leaving a net of ${fmtINR(monthNet)}. What would you like to know?`;

    case "savings": {
      if (savingsRate <= 0) {
        return `Your current savings rate is ${savingsRate}% — expenses are exceeding income. I'd recommend reviewing your top spending categories and setting a monthly budget to get back on track.\n\nYour biggest expense this month is ${topCat ? topCat.name + " at " + fmtINR(topCat.amount) : "not yet categorised"}. Even cutting 10% there would make a meaningful difference.`;
      }
      if (savingsRate < 20) {
        return `Your savings rate is ${savingsRate}% — you're saving some, but the healthy target is 20% or more. This month you saved ${fmtINR(monthNet)} out of ${fmtINR(monthIncome)} income.\n\nTo improve: focus on reducing ${topCat ? topCat.name + " (currently " + topCat.pct + "% of expenses)" : "your top expense category"}. Small consistent cuts add up quickly.`;
      }
      return `Great news — your savings rate is ${savingsRate}%, above the recommended 20% target. You've saved ${fmtINR(monthNet)} this month out of ${fmtINR(monthIncome)} income.\n\nKeep this up and consider putting the surplus into an emergency fund or a recurring investment to make your money work harder.`;
    }

    case "expenses": {
      const breakdown = topCategories.slice(0, 3)
        .map(c => `• ${c.name}: ${fmtINR(c.amount)} (${c.pct}%)`)
        .join("\n");
      return `This month you've spent ${fmtINR(monthExpense)} across ${topCategories.length} categor${topCategories.length !== 1 ? "ies" : "y"}. Here's your top breakdown:\n\n${breakdown || "• No expense categories yet"}\n\nYour biggest spend is ${topCat ? topCat.name + " at " + topCat.pct + "% of total expenses" : "not yet recorded"}.`;
    }

    case "budget": {
      if (!budgetSet) {
        return `You haven't set a monthly budget yet. Head to the Budget page to set one — it's the single most effective way to control spending.\n\nBased on your current spend of ${fmtINR(monthExpense)} this month, a good starting budget would be around ${fmtINR(Math.ceil(monthExpense * 1.1 / 1000) * 1000)} — slightly above current spend to give yourself room to adjust.`;
      }
      if (usedPct > 100) {
        return `You've exceeded your monthly budget of ${fmtINR(budget.monthlyBudget)} — current spend is ${fmtINR(monthExpense)} (${usedPct}% used).\n\nTo recover: pause non-essential purchases for the rest of the month. Your top expense is ${topCat ? topCat.name + " at " + fmtINR(topCat.amount) : "unlisted"} — consider reducing it next month.`;
      }
      if (usedPct >= 80) {
        return `You've used ${usedPct}% of your ${fmtINR(budget.monthlyBudget)} monthly budget with ${fmtINR(remaining)} remaining. You're getting close — be mindful of discretionary spending for the rest of the month.\n\nTop category this month: ${topCat ? topCat.name + " — " + fmtINR(topCat.amount) : "not tracked"}.`;
      }
      return `You've used ${usedPct}% of your monthly budget. Spent ${fmtINR(monthExpense)} of ${fmtINR(budget.monthlyBudget)}, with ${fmtINR(remaining)} remaining — you're on track!\n\nTop spending category: ${topCat ? topCat.name + " at " + fmtINR(topCat.amount) : "not yet recorded"}.`;
    }

    case "income":
      return `This month your total income is ${fmtINR(monthIncome)}. All-time you've recorded ${fmtINR(totalIncome)} in income across ${totalTransactions} transactions.\n\nAfter ${fmtINR(monthExpense)} in expenses, your net this month is ${fmtINR(monthNet)}. ${monthNet >= 0 ? "You're in positive territory — keep it up!" : "Expenses are exceeding income this month — review your top spending categories."}`;

    case "tips": {
      const tips = [];
      if (topCat && topCat.pct > 35) {
        tips.push(`• ${topCat.name} is ${topCat.pct}% of your spending (${fmtINR(topCat.amount)}). Look for ways to cut 10–15% there.`);
      }
      if (savingsRate < 20) {
        tips.push(`• Aim for a 20% savings rate. You're at ${savingsRate}% — try increasing it by ₹500–1,000 per month.`);
      }
      if (!budgetSet) {
        tips.push("• Set a monthly budget on the Budget page. Even a rough number keeps you aware.");
      }
      if (topCategories.length > 3) {
        const smallCats = topCategories.slice(-2).map(c => c.name).join(" and ");
        tips.push(`• Consolidate small expenses in ${smallCats} — many small purchases add up silently.`);
      }
      tips.push("• Review subscriptions monthly — unused ones are easy wins.");
      tips.push("• The 24-hour rule: wait a day before non-essential purchases over ₹500.");

      return `Here are personalised tips based on your data:\n\n${tips.slice(0, 4).join("\n")}`;
    }

    case "topCategory": {
      if (!topCategories.length) {
        return "You don't have any expense transactions recorded yet. Add your expenses on the Transactions page to see a category breakdown.";
      }
      const top3 = topCategories.slice(0, 3)
        .map((c, i) => `${i + 1}. ${c.name} — ${fmtINR(c.amount)} (${c.pct}% of expenses)`)
        .join("\n");
      return `Your top spending categories this month:\n\n${top3}\n\n${topCat.name} leads at ${topCat.pct}% of total spend. ${topCat.pct > 40 ? "That's quite high — it may be worth reviewing." : "That looks within a reasonable range."}`;
    }

    case "recent": {
      if (!recentTxns.length) {
        return "No transactions found yet. Add your first one on the Transactions page!";
      }
      const lines = recentTxns.map(t => {
        const sign = t.type === "income" ? "+" : "−";
        const date = new Date(t.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
        return `• ${sign}${fmtINR(t.amount)} · ${t.category}${t.note ? " (" + t.note + ")" : ""} · ${date}`;
      }).join("\n");
      return `Your ${recentTxns.length} most recent transactions:\n\n${lines}`;
    }

    case "netBalance": {
      const status = monthNet >= 0 ? "positive" : "negative";
      return `Your net cash flow this month is ${fmtINR(monthNet)} — that's ${status}.\n\nIncome:   ${fmtINR(monthIncome)}\nExpenses: ${fmtINR(monthExpense)}\n\n${monthNet >= 0 ? "You're spending less than you earn — a healthy sign. Consider investing the surplus." : "Expenses exceed income this month. Review your top categories and look for areas to cut back."}`;
    }

    case "goals": {
      const monthlySavings   = monthNet > 0 ? monthNet : 0;
      const annualProjection = monthlySavings * 12;
      const emergencyTarget  = monthExpense * 3;
      const monthsToEmergency = monthlySavings > 0
        ? Math.ceil(emergencyTarget / monthlySavings) : null;

      return `Based on your current savings of ${fmtINR(monthlySavings)}/month, you're on track to save ${fmtINR(annualProjection)} this year.\n\nGoal tracker:\n• Emergency fund (3× monthly expenses = ${fmtINR(emergencyTarget)}): ${monthsToEmergency ? monthsToEmergency + " months away" : "increase savings first"}\n• Boosting savings by 10% per month would add ${fmtINR(monthlySavings * 0.1 * 12)} to your annual total.`;
    }

    default: {
      const summary = `This month: ${fmtINR(monthIncome)} income · ${fmtINR(monthExpense)} expenses · ${fmtINR(monthNet)} net.`;
      return `I'm here to help with your personal finances! ${summary}\n\nYou can ask me about your savings rate, spending breakdown, budget status, top categories, recent transactions, or tips to save more. What would you like to explore?`;
    }
  }
}

/* ─────────────────────────────────────────────
   POST /api/chat
   Body: { message: string, history?: Array }
   No external API — runs entirely on your server.
───────────────────────────────────────────── */
const chat = async (req, res) => {
  try {
    const { message } = req.body;

    // Input validation
    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: "message is required and must be a non-empty string",
      });
    }

    if (message.trim().length > 1000) {
      return res.status(400).json({
        success: false,
        message: "message must be 1000 characters or fewer",
      });
    }

    // Build context from MongoDB
    let ctx;
    try {
      ctx = await buildFinancialContext();
    } catch (dbErr) {
      console.warn("Could not load financial context:", dbErr.message);
      ctx = {
        month: currentMonth(),
        monthIncome: 0, monthExpense: 0, monthNet: 0,
        totalIncome: 0, totalExpense: 0, savingsRate: 0,
        topCategories: [], recentTxns: [], budget: null,
        totalTransactions: 0,
      };
    }

    // Generate response — no API call, no key needed
    const reply = generateResponse(message.trim(), ctx);

    // Small delay so the typing indicator feels natural in the UI
    await new Promise(resolve => setTimeout(resolve, 500));

    // Persist both turns to MongoDB (fire-and-forget pattern:
    // we don't await here so storage errors never block the response)
    ChatMessage.insertMany([
      { role: "user",      message: message.trim() },
      { role: "assistant", message: reply           },
    ]).catch(err => console.warn("Chat history save failed:", err.message));

    res.status(200).json({
      success: true,
      reply,
    });

  } catch (error) {
    console.error("Chat error:", error.message || error);
    res.status(500).json({
      success: false,
      message: "Failed to generate a response. Please try again.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/* ─────────────────────────────────────────────
   GET /api/chat/history
   Return all stored messages, oldest first.
   Optional query: ?limit=50 (default 100)
───────────────────────────────────────────── */
const getChatHistory = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 100, 500);

    const messages = await ChatMessage
      .find()
      .sort({ createdAt: 1 })
      .limit(limit)
      .lean();

    res.status(200).json({
      success: true,
      count:   messages.length,
      data:    messages,
    });
  } catch (error) {
    console.error("Chat history error:", error.message || error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch chat history.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

module.exports = { chat, getChatHistory };
