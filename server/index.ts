// Load environment variables from .env file
import { config } from 'dotenv';
config();

// Cross-platform crypto setup
import { webcrypto } from "crypto";

// Comprehensive crypto polyfill for cross-platform compatibility
function setupServerCrypto() {
  // Check if crypto is already properly set up
  if (globalThis.crypto && 
      typeof globalThis.crypto.getRandomValues === 'function' && 
      typeof globalThis.crypto.randomUUID === 'function') {
    return;
  }

  try {
    // Use Node.js webcrypto if available (Node 16+)
    if (webcrypto && 
        typeof webcrypto.getRandomValues === 'function' && 
        typeof webcrypto.randomUUID === 'function') {
      Object.defineProperty(globalThis, "crypto", {
        value: webcrypto,
        configurable: true,
        writable: true
      });
      console.log('✅ Server crypto initialized with Node.js webcrypto');
      return;
    }

    // Fallback polyfill
    const crypto = require('crypto');
    const cryptoPolyfill: any = {};

    // Add getRandomValues
    cryptoPolyfill.getRandomValues = function(array: any) {
      if (!array || typeof array.byteLength !== 'number') {
        throw new TypeError('Expected a TypedArray');
      }
      const bytes = crypto.randomBytes(array.byteLength);
      if (array instanceof Uint8Array) {
        array.set(bytes);
      } else {
        const view = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
        view.set(bytes);
      }
      return array;
    };

    // Add randomUUID
    cryptoPolyfill.randomUUID = function() {
      const bytes = crypto.randomBytes(16);
      bytes[6] = (bytes[6] & 0x0f) | 0x40; // Version 4
      bytes[8] = (bytes[8] & 0x3f) | 0x80; // Variant 10
      const hex = bytes.toString('hex');
      return [
        hex.slice(0, 8),
        hex.slice(8, 12),
        hex.slice(12, 16),
        hex.slice(16, 20),
        hex.slice(20, 32)
      ].join('-');
    };

    Object.defineProperty(globalThis, "crypto", {
      value: cryptoPolyfill,
      configurable: true,
      writable: true
    });

    console.log('✅ Server crypto initialized with polyfill');
  } catch (error) {
    console.error('❌ Failed to setup server crypto:', error);
  }
}

// Initialize crypto before anything else
setupServerCrypto();

import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: false, limit: '50mb' }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  // Global error handler for all errors including PayloadTooLargeError
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    let message = err.message || "Internal Server Error";
    
    // Handle specific error types
    if (err.type === 'entity.too.large' || err.name === 'PayloadTooLargeError') {
      message = "Request payload is too large. Please reduce the size of your upload.";
    }
    
    // Always return JSON, never HTML for errors
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

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Serve the app on port 5000 for local development
  // this serves both the API and the client.
  const port = process.env.PORT ? parseInt(process.env.PORT) : 5000;
  server.listen({
    port,
    host: "0.0.0.0",
  }, () => {
    log(`serving on port ${port} (http://localhost:${port})`);
  });
})();
