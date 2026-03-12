const path = require("path");
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const swaggerUi = require("swagger-ui-express");

const swaggerSpec = require("./swagger");
const authRoutes = require("./modules/auth/auth.routes");
const userRoutes = require("./modules/user/user.routes");
const sportsRoutes = require("./modules/sports/sports.routes");
const adminRoutes = require("./modules/admin/admin.routes");
const superAdminRoutes = require("./modules/superadmin/superadmin.routes");
const friendRoutes = require("./modules/friends/friend.routes");
const sportTypeRoutes = require("./modules/sportType/sportType.routes");
const roomRoutes = require("./modules/room/room.routes");
const matchRoutes = require("./modules/match/match.routes");
const auditLogRoutes = require("./modules/auditLog/auditLog.routes");
const analyticsRoutes = require("./modules/analytics/analytics.routes");
const leaderboardRoutes = require("./modules/leaderboard/leaderboard.routes");
const highlightsRoutes = require("./modules/highlights/highlights.routes");
const appConfigRoutes = require("./modules/appConfig/appConfig.routes");

const { apiLimiter } = require("./middlewares/rateLimiter");
const { maintenanceCheck } = require("./middlewares/maintenance.middleware");

const app = express();

// Trust proxy on hosted environments (Render, etc.) so express-rate-limit works correctly
app.set('trust proxy', 1);

app.use(cors());
app.use(morgan("dev"));
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));
app.use(apiLimiter);

// ── Swagger UI ───────────────────────────────────────────────────────────────
app.use(
  "/api/docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    customSiteTitle: "Unified Sports API Docs",
    swaggerOptions: {
      persistAuthorization: true, // keeps the Bearer token between page reloads
      displayRequestDuration: true,
      docExpansion: "list", // show tags collapsed, endpoints listed
      filter: true, // enable search bar
    },
  }),
);

// Expose the raw OpenAPI JSON spec (useful for Postman imports)
app.get("/api/docs.json", (_req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.send(swaggerSpec);
});

// ── App Config (public + admin) ──────────────────────────────────────────────
app.use("/api/app-config", appConfigRoutes);

// ── Maintenance gate (blocks non-admin routes when enabled) ──────────────────
app.use(maintenanceCheck);

// ── API Routes ───────────────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/superadmin", superAdminRoutes);
app.use("/api/user", userRoutes);
app.use("/api/sports", sportsRoutes);
app.use("/api/friends", friendRoutes);
app.use("/api/sport-types", sportTypeRoutes);
app.use("/api/rooms", roomRoutes);
app.use("/api/matches", matchRoutes);
app.use("/api/audit-logs", auditLogRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/leaderboards", leaderboardRoutes);
app.use("/api/highlights", highlightsRoutes);

app.get("/", (_req, res) => {
  res.json({
    message: "Unified Sports API is running",
    docs: "/api/docs",
  });
});

// ── Global error handler ─────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  // Mongoose validation error (e.g. username too short, required field missing)
  if (err.name === "ValidationError") {
    const message = Object.values(err.errors)
      .map((e) => e.message)
      .join(", ");
    return res.status(400).json({ message });
  }

  // MongoDB duplicate key (e.g. duplicate email / username)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || "field";
    return res.status(409).json({ message: `${field} is already taken` });
  }

  // JWT errors
  if (err.name === "JsonWebTokenError")
    return res.status(401).json({ message: "Invalid token" });
  if (err.name === "TokenExpiredError")
    return res.status(401).json({ message: "Token expired" });

  // Application errors thrown via fail() — err.status is set
  const statusCode = err.status || 500;
  const message = err.message || "Internal Server Error";

  if (statusCode === 500) console.error(err.stack);

  res.status(statusCode).json({ message });
});

module.exports = app;
