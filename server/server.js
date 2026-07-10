const express    = require("express");
const mongoose   = require("mongoose");
const cors       = require("cors");
const dotenv     = require("dotenv");

// Load environment variables from .env
dotenv.config();

const transactionRoutes = require("./routes/transactionRoutes");
const budgetRoutes      = require("./routes/budgetRoutes");
const chatRoutes        = require("./routes/chatRoutes");
const noteRoutes        = require("./routes/noteRoutes");

const app  = express();
const PORT = process.env.PORT || 5000;

/* ─────────────────────────────────────────────
   MIDDLEWARE
───────────────────────────────────────────── */
app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:5173", // Vite default port
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type"],
}));

app.use(express.json());           // parse JSON request bodies
app.use(express.urlencoded({ extended: true }));

/* ─────────────────────────────────────────────
   ROUTES
───────────────────────────────────────────── */
app.use("/api/transactions", transactionRoutes);
app.use("/api/budget",       budgetRoutes);
app.use("/api/chat",         chatRoutes);
app.use("/api/notes",        noteRoutes);

// Health check
app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Finio API is running",
    timestamp: new Date().toISOString(),
  });
});

// 404 handler for unmatched routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`,
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err.stack);
  res.status(500).json({
    success: false,
    message: "An unexpected error occurred",
    error: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

/* ─────────────────────────────────────────────
   MONGODB CONNECTION + SERVER START
───────────────────────────────────────────── */
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      // These options are defaults in Mongoose 6+ but explicit for clarity
      serverSelectionTimeoutMS: 5000, // fail fast if MongoDB is unreachable
    });

    console.log(`✓ MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    console.error("✗ MongoDB connection failed:", error.message);
    process.exit(1); // exit so the process manager can restart
  }
};

const startServer = async () => {
  await connectDB();

  app.listen(PORT, () => {
    console.log(`✓ Server running on http://localhost:${PORT}`);
    console.log(`  Environment : ${process.env.NODE_ENV || "development"}`);
    console.log(`  API base    : http://localhost:${PORT}/api`);
  });
};

startServer();
