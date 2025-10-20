import express, { Request, Response, NextFunction } from "express";
import cookieParser from "cookie-parser";
import logger from "morgan";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import csrf from "csurf";
import { env } from "./config.js";
import path from "path";

import authRouter from "./routes/auth.js";
import usersRouter from "./routes/users.js";
import conversationsRouter from "./routes/conversations.js";
import messagesRouter from "./routes/messages.js";
import uploadsRouter from "./routes/uploads.js";
import keysRouter from "./routes/keys.js";

const app = express();

// === SECURITY / CORS ===
app.use(helmet());

app.use(
  cors({
    origin: env.corsOrigin || "http://localhost:5173",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "CSRF-Token"],
  })
);

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 menit
    max: 100, // max 100 request / 15 menit
    standardHeaders: true,
    legacyHeaders: false,
  })
);

// === MIDDLEWARE ===
app.use(logger("dev"));
app.use(cookieParser());
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));

// === CSRF Protection ===
app.use(csrf({
  cookie: { httpOnly: true, sameSite: "strict", secure: env.nodeEnv === "production" }
}));

// === ROUTE FOR CSRF TOKEN ===
app.get("/api/csrf-token", (req: Request, res: Response, next) => {
  try {
    const token = req.csrfToken();
    res.json({ csrfToken: token });
  } catch (err) {
    console.error("CSRF generation failed:", err);
    next(err);
  }
});

// === STATIC FILES ===
app.use("/uploads", cors({
  origin: env.corsOrigin || "http://localhost:5173",
  credentials: true
}), express.static(path.resolve(process.cwd(), env.uploadDir)));

// === ROUTES ===
app.use("/api/auth", authRouter);
app.use("/api/users", usersRouter);
app.use("/api/conversations", conversationsRouter);
app.use("/api/messages", messagesRouter);
app.use("/api/uploads", uploadsRouter); // Changed from /api/conversations to /api/uploads
app.use("/api/keys", keysRouter);

// === HEALTH CHECK ===
app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

// === ERROR HANDLING ===
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  if (err?.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Invalid JSON" });
  }
  if (err?.status && err?.message) {
    return res.status(err.status).json({ error: err.message });
  }

  console.error("❌ Server Error:", err);
  res.status(500).json({ error: "Internal server error" });
});

export default app;
