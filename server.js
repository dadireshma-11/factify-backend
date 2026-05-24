import express from "express";
import path from "path";
import dotenv from "dotenv";
import cors from "cors";
import nodemailer from "nodemailer";
import { GoogleGenerativeAI } from "@google/generative-ai";
import connectDB from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import historyRoutes from "./routes/historyRoutes.js";
import bookmarkRoutes from "./routes/bookmarkRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import predictRoutes from "./routes/predictRoutes.js";
import contactRoutes from "./routes/contactRoutes.js";
import transcribeRoutes from "./routes/transcribeRoutes.js";

dotenv.config();

const geminiValidationEnabled =
  String(process.env.GEMINI_API_KEY_VALIDATION || "true").toLowerCase() !==
  "false";

console.log("=== SERVER STARTING ===");
console.log("GEMINI_API_KEY loaded:", !!process.env.GEMINI_API_KEY);
console.log("GEMINI_API_KEY_VALIDATION:", geminiValidationEnabled);
console.log("Key starts with:", process.env.GEMINI_API_KEY?.slice(0, 10));
console.log("MONGO_URI loaded:", !!process.env.MONGO_URI);
console.log(
  "Email (contact/alerts) configured:",
  !!(process.env.EMAIL_USER && process.env.EMAIL_PASS)
);

// Optional: create a transporter here for quick debugging/verification
// Uses the same credentials expected by server/utils/sendEmail.js
let transporter = null;
try {
  const emailUser = (process.env.EMAIL_USER || process.env.SMTP_EMAIL || "").trim();
  const emailPass = (process.env.EMAIL_PASS || process.env.SMTP_APP_PASSWORD || "").replace(/\s/g, "");

  if (emailUser && emailPass) {
    transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: {
        user: emailUser,
        pass: emailPass,
      },
      family: 4,
      tls: {
        rejectUnauthorized: false,
      },
    });

    console.log("Debug email transporter created (not verified)");
  } else {
    console.log("Debug email transporter not created: missing EMAIL_USER/EMAIL_PASS");
  }
} catch (err) {
  console.error("Failed to create debug email transporter:", err.message);
}


const app = express();

app.set("trust proxy", 1);

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/history", historyRoutes);
app.use("/api/bookmarks", bookmarkRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/predict", predictRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/transcribe", transcribeRoutes);

// Test route
app.get("/", (req, res) => {
  res.send("Factify API is running...");
});

if (process.env.NODE_ENV === "production") {
  const clientBuildPath = path.resolve("../client/dist");
  app.use(express.static(clientBuildPath));

  app.get(/^(?!\/api).*$/, (req, res) => {
    res.sendFile(path.join(clientBuildPath, "index.html"));
  });
}

// Global error handler
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({
    message: err.message || "Internal server error",
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

const PORT = process.env.PORT || 5000;

const verifyGeminiApiKey = async () => {
  if (!process.env.GEMINI_API_KEY) {
    console.warn(
      "[Gemini] GEMINI_API_KEY is not configured. Set a valid key in server/.env to enable Gemini, or leave it unset/removed to keep using heuristics."
    );
    return;
  }

  if (!geminiValidationEnabled) {
    console.warn(
      "[Gemini] GEMINI_API_KEY_VALIDATION is false. Skipping Gemini key validation."
    );
    return;
  }
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel(
      { model: "gemini-1.0-pro" },
      { apiVersion: "v1" }
    );
    const response = await model.generateContent(
      "Please respond with the single word OK."
    );
    const text = String(response?.response?.text?.() || "").trim();

    if (!/ok/i.test(text)) {
      throw new Error(
        `[Gemini] API key validation failed: unexpected response: ${text}`
      );
    }

    console.log("[Gemini] API key validation succeeded.");
  } catch (error) {
    console.error("[Gemini] API key validation failed:", error.message);
    throw new Error(
      "[Gemini] Invalid GEMINI_API_KEY detected. Fix the key in server/.env or remove it to disable Gemini integration."
    );
  }
};

const startServer = async () => {
  await verifyGeminiApiKey();
  await connectDB();
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
};

startServer().catch((error) => {
  console.error("Failed to start server:", error.message);
  process.exitCode = 1;
  setTimeout(() => process.exit(1), 100);
});


