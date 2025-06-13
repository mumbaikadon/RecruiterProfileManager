// Local development server entry point
import 'dotenv/config';
import express from "express";
import session from "express-session";
import { createServer } from "http";
import { setupVite, serveStatic, log } from "./vite";
import { registerRoutes } from "./routes";

// Import the local database connection
import { pool } from "./local-db";

// Basic middleware setup
const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: false, limit: '50mb' }));
const server = createServer(app);

// Create a memory store for sessions
const MemoryStore = require('memorystore')(session);

// Use the memory store for sessions in development
app.use(
  session({
    store: new MemoryStore({
      checkPeriod: 86400000 // prune expired entries every 24h
    }),
    secret: process.env.SESSION_SECRET || "development-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  })
);

// Error handling middleware
app.use((err: any, req: any, res: any, next: any) => {
  const status = err.status || 500;
  const message = err.message || "Internal Server Error";
  
  res.status(status).json({ 
    message,
    error: err.name || "ServerError", 
    isError: true 
  });
  
  // Only throw in development to see stack trace in console
  if (process.env.NODE_ENV === 'development') {
    console.error("Server error:", err);
  }
});

// Set up the server
(async () => {
  try {
    // Setup API routes
    await registerRoutes(app);
    
    // Setup static files or Vite dev server
    if (app.get("env") === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    // Use port from environment variable or default to 3000
    const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;
    
    server.listen({
      port,
      host: "127.0.0.1",
    }, () => {
      log(`serving on port ${port} (http://localhost:${port})`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
})();
