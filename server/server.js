import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import authRoutes from "./routes/auth.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Allowed frontend origins (dev + production)
const allowedOrigins = [
  "http://localhost:5173",
  "https://iitdh-chess-club.vercel.app",
];

// CORS Middleware
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g., non-browser clients like Postman)
      if (!origin) return callback(null, true);
      // Check if the request origin is in the allowedOrigins array
      if (allowedOrigins.includes(origin)) {
        callback(null, origin); // Return the specific origin
      } else {
        console.log(`Blocked CORS request from origin: ${origin}`); // Debug log
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true, // Allow credentials (cookies, etc.)
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"], // Allow necessary methods
    allowedHeaders: ["Content-Type", "Authorization"], // Allow necessary headers
  })
);

// JSON Parser
app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);

// Health Check Route
app.get("/api/health", (req, res) => {
  res.json({ message: "Server is running!" });
});

// MongoDB Connection
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("MongoDB Atlas connected successfully");
  } catch (error) {
    console.error("MongoDB connection error:", error.message);
    process.exit(1);
  }
};

// Start Server
const startServer = async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Client URL: ${process.env.CLIENT_URL || "http://localhost:5173"}`);
  });
};

startServer();